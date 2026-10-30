import sys
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal, TypedDict
from uuid import uuid4

import joblib
import numpy as np
import pandas as pd
import shap
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt
from pydantic import BaseModel, Field

from fastapi import Depends, FastAPI, HTTPException
from fastapi.security import OAuth2PasswordRequestForm

from auth_security import create_access_token
from users import authenticate_user
from auth_security import create_access_token,decode_access_token,oauth2_scheme


from openai import APIError
from rag.generator import answer_question

# ============================================================
# 1. Configuration
# ============================================================

BASE_DIR = Path(__file__).resolve().parent
AUDIT_PATH = BASE_DIR / "reports" / "human_review_audit.jsonl"
FEATURES = [
    "country",
    "hour",
    "failed_attempts",
    "new_device",
    "ip_risk_score",
    "impossible_travel",
    "country_unusual",
    "hour_unusual",
]

app = FastAPI(
    title="IdentityShield AI",
    description="Enterprise Identity Security Copilot",
    version="0.4.0",
)

def get_current_user(
    token: str = Depends(oauth2_scheme),) -> dict[str, str]:

    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=401,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )

    username = payload.get("sub")
    role = payload.get("role")

    if not username or not role:
        raise HTTPException(
            status_code=401,
            detail="Token incomplet",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {
        "username": username,
        "role": role,
    }

def require_roles(*allowed_roles: str):
    def role_checker(
        current_user: dict[str, str] = Depends(get_current_user),
    ) -> dict[str, str]:
        if current_user["role"] not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail="Accès interdit pour ce rôle",
            )

        return current_user

    return role_checker

@app.post("/token")
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
):
    user = authenticate_user(
        form_data.username,
        form_data.password,
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="Identifiants incorrects",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={
            "sub": user["username"],
            "role": user["role"],
        }
    )

    return {
        "access_token": access_token,
        "token_type": "bearer",
    }

# ============================================================
# 2. Load model and selected configuration
# ============================================================

CONFIG_PATH = (
    BASE_DIR / "reports" / "threshold_selection" / "selected_configuration.json"
)

with CONFIG_PATH.open("r", encoding="utf-8") as file:
    selected_config = json.load(file)

if not selected_config.get("validation_only", False):
    raise ValueError(
        "La configuration doit avoir été sélectionnée sur la validation."
    )

MODEL_NAME = selected_config["selected_model"]
THRESHOLD = float(selected_config["selected_threshold"])

MODEL_PATHS = {
    "LogisticRegression": BASE_DIR / "models" / "logisticregression.joblib",
    "RandomForest": BASE_DIR / "models" / "randomforest.joblib",
}

if MODEL_NAME not in MODEL_PATHS:
    raise ValueError(f"Modèle non reconnu : {MODEL_NAME}")

model = joblib.load(MODEL_PATHS[MODEL_NAME])

if not hasattr(model, "named_steps"):
    raise ValueError("Le modèle chargé n'est pas un pipeline sklearn attendu.")
if "preprocessor" not in model.named_steps:
    raise ValueError("Étape 'preprocessor' absente du pipeline.")
if "classifier" not in model.named_steps:
    raise ValueError("Étape 'classifier' absente du pipeline.")

preprocessor = model.named_steps["preprocessor"]
classifier = model.named_steps["classifier"]

print(f"Modèle chargé : {MODEL_NAME}", file=sys.stderr)
print(f"Seuil de décision : {THRESHOLD:.2f}", file=sys.stderr)


# ============================================================
# 3. Load synthetic user profiles
# ============================================================

PROFILES_PATH = BASE_DIR / "data" / "user_profiles.csv"
profiles_df = pd.read_csv(PROFILES_PATH)

required_profile_columns = {"user_id", "home_country", "usual_hour"}
missing_profile_columns = required_profile_columns - set(profiles_df.columns)
if missing_profile_columns:
    raise ValueError(
        "Colonnes manquantes dans user_profiles.csv : "
        f"{sorted(missing_profile_columns)}"
    )

profiles_df["user_id"] = profiles_df["user_id"].astype(str).str.strip()
if profiles_df["user_id"].duplicated().any():
    raise ValueError("Des user_id sont dupliqués dans user_profiles.csv.")

USER_PROFILES = {
    row["user_id"]: {
        "home_country": str(row["home_country"]),
        "usual_hour": int(row["usual_hour"]),
    }
    for _, row in profiles_df.iterrows()
}

print(f"Profils chargés : {len(USER_PROFILES)}", file=sys.stderr)


# ============================================================
# 4. Initialize SHAP
# ============================================================

DATA_PATH = BASE_DIR / "data" / "access_events.csv"
reference_df = pd.read_csv(DATA_PATH)

missing_features = [
    feature for feature in FEATURES if feature not in reference_df.columns
]
if missing_features:
    raise ValueError(
        f"Variables manquantes dans access_events.csv : {missing_features}"
    )

reference_X = reference_df[FEATURES].sample(
    n=min(100, len(reference_df)),
    random_state=42,
)
reference_transformed = preprocessor.transform(reference_X)
if hasattr(reference_transformed, "toarray"):
    reference_transformed = reference_transformed.toarray()

FEATURE_NAMES = preprocessor.get_feature_names_out()

if MODEL_NAME == "LogisticRegression":
    explainer = shap.LinearExplainer(classifier, reference_transformed)
else:
    explainer = shap.TreeExplainer(classifier)


# ============================================================
# 5. Request schemas
# ============================================================

class AccessEvent(BaseModel):
    user_id: str = Field(min_length=1, max_length=100)
    country: str = Field(min_length=2, max_length=100)
    hour: int = Field(ge=0, le=23)
    failed_attempts: int = Field(default=0, ge=0, le=100)
    new_device: int = Field(default=0, ge=0, le=1)
    ip_risk_score: float = Field(default=0, ge=0, le=100)
    impossible_travel: int = Field(default=0, ge=0, le=1)


class ReviewDecisionRequest(BaseModel):
    analysis_id: str = Field(min_length=1)
    decision: Literal["confirm_suspicious", "mark_legitimate"]

class RAGQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    top_k: int = Field(default=3, ge=1, le=5)


# ============================================================
# 6. Prepare ML features
# ============================================================

def get_user_profile(user_id: str) -> dict:
    profile = USER_PROFILES.get(user_id.strip())
    if profile is None:
        raise HTTPException(
            status_code=404,
            detail=f"Profil utilisateur fictif introuvable : {user_id}",
        )
    return profile


def build_event_features(event: AccessEvent, profile: dict) -> pd.DataFrame:
    event_data = {
        "country": event.country,
        "hour": event.hour,
        "failed_attempts": event.failed_attempts,
        "new_device": event.new_device,
        "ip_risk_score": event.ip_risk_score,
        "impossible_travel": event.impossible_travel,
        "country_unusual": int(event.country != profile["home_country"]),
        "hour_unusual": int(abs(event.hour - profile["usual_hour"]) >= 6),
    }
    return pd.DataFrame([event_data], columns=FEATURES)


# ============================================================
# 7. Rule-based risk analysis
# ============================================================

def calculate_risk(event: AccessEvent) -> dict:
    profile = get_user_profile(event.user_id)
    score = 0
    reasons = []

    if event.country != profile["home_country"]:
        score += 50
        reasons.append(f"Pays inhabituel : {event.country}")

    usual_hour = profile["usual_hour"]
    if abs(event.hour - usual_hour) >= 6:
        score += 20
        reasons.append(
            f"Connexion à {event.hour}h, éloignée de l'heure habituelle "
            f"({usual_hour}h)"
        )

    if event.failed_attempts >= 3:
        score += min(event.failed_attempts * 10, 30)
        reasons.append(f"{event.failed_attempts} tentatives échouées")

    if event.new_device == 1:
        reasons.append("Connexion depuis un nouvel appareil")

    if event.impossible_travel == 1:
        score += 50
        reasons.append("Indicateur de voyage impossible")

    score = min(score, 100)
    if score >= 70:
        level = "HIGH"
    elif score >= 30:
        level = "MEDIUM"
    else:
        level = "LOW"

    if not reasons:
        reasons.append("Aucun indicateur détecté par les règles actuelles")

    return {
        "user_id": event.user_id,
        "risk_score": score,
        "risk_level": level,
        "reasons": reasons,
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
    }


# ============================================================
# 8. ML analysis and SHAP explanations
# ============================================================

def explain_with_shap(event: AccessEvent) -> dict:
    profile = get_user_profile(event.user_id)
    X = build_event_features(event, profile)

    probabilities = model.predict_proba(X)[0]
    classes = list(model.classes_)
    suspect_index = classes.index(1)
    suspect_probability = float(probabilities[suspect_index])
    prediction = int(suspect_probability >= THRESHOLD)

    X_transformed = preprocessor.transform(X)
    if hasattr(X_transformed, "toarray"):
        X_transformed = X_transformed.toarray()

    raw_shap_values = explainer.shap_values(X_transformed)
    if isinstance(raw_shap_values, list):
        values = np.asarray(raw_shap_values[suspect_index])[0]
    else:
        values = np.asarray(raw_shap_values)
        if values.ndim == 3:
            values = values[0, :, suspect_index]
        elif values.ndim == 2:
            values = values[0]
        elif values.ndim != 1:
            raise ValueError(f"Format SHAP inattendu : {values.shape}")

    values = np.asarray(values).reshape(-1)
    if len(values) != len(FEATURE_NAMES):
        raise ValueError(
            "Le nombre de valeurs SHAP ne correspond pas "
            "au nombre de variables transformées."
        )

    explanations = []
    for feature, value in zip(FEATURE_NAMES, values):
        name = str(feature)
        contribution = float(value)

        if name == "numeric__ip_risk_score":
            label = "Score de risque IP"
        elif name == "numeric__failed_attempts":
            label = "Tentatives de connexion échouées"
        elif name == "numeric__hour":
            label = "Heure de connexion"
        elif name == "numeric__new_device":
            label = "Nouvel appareil"
        elif name == "numeric__impossible_travel":
            label = "Signal de voyage impossible"
        elif name == "numeric__country_unusual":
            label = "Pays inhabituel pour l'utilisateur"
        elif name == "numeric__hour_unusual":
            label = "Heure inhabituelle pour l'utilisateur"
        elif name.startswith("categorical__country_"):
            country = name.replace("categorical__country_", "")
            label = f"Pays encodé : {country}"
        else:
            label = name

        if contribution > 0:
            direction = "increases_suspicion"
        elif contribution < 0:
            direction = "decreases_suspicion"
        else:
            direction = "neutral"

        explanations.append({
            "factor": label,
            "shap_value": round(contribution, 6),
            "direction": direction,
        })

    explanations.sort(key=lambda item: abs(item["shap_value"]), reverse=True)
    return {
        "prediction": "SUSPECT" if prediction == 1 else "NORMAL",
        "suspect_probability": round(suspect_probability, 6),
        "decision_threshold": THRESHOLD,
        "explanations": explanations[:8],
    }


# ============================================================
# 9. LangGraph workflow
# ============================================================

class AnalysisState(TypedDict, total=False):
    event: AccessEvent
    rule_result: dict
    ml_result: dict
    recommended_action: str
    review_decision: str


def rules_node(state: AnalysisState) -> dict:
    return {"rule_result": calculate_risk(state["event"])}


def ml_node(state: AnalysisState) -> dict:
    return {"ml_result": explain_with_shap(state["event"])}


def route_by_risk(state: AnalysisState) -> str:
    return "review" if state["rule_result"]["risk_level"] == "HIGH" else "normal"


def human_review_node(state: AnalysisState) -> dict:
    decision = interrupt({
        "message": "Une revue humaine est nécessaire.",
        "user_id": state["rule_result"]["user_id"],
        "risk_score": state["rule_result"]["risk_score"],
        "risk_level": state["rule_result"]["risk_level"],
        "allowed_decisions": ["confirm_suspicious", "mark_legitimate"],
    })

    if decision == "confirm_suspicious":
        action = "ESCALATE_AS_SUSPICIOUS"
    elif decision == "mark_legitimate":
        action = "CLOSE_AS_LEGITIMATE"
    else:
        raise ValueError("Décision de revue non prise en charge.")

    return {
        "review_decision": decision,
        "recommended_action": action,
    }


def normal_node(state: AnalysisState) -> dict:
    return {"recommended_action": "NO_ESCALATION"}


workflow = StateGraph(AnalysisState)
workflow.add_node("rules", rules_node)
workflow.add_node("ml_analysis", ml_node)
workflow.add_node("human_review", human_review_node)
workflow.add_node("normal", normal_node)
workflow.add_edge(START, "rules")
workflow.add_edge("rules", "ml_analysis")
workflow.add_conditional_edges(
    "ml_analysis",
    route_by_risk,
    {"review": "human_review", "normal": "normal"},
)
workflow.add_edge("human_review", END)
workflow.add_edge("normal", END)

checkpointer = InMemorySaver()
analysis_graph = workflow.compile(checkpointer=checkpointer)


# ============================================================
# 10. Human-review audit log
# ============================================================

def record_review_audit(analysis_id: str, result: dict) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "analysis_id": analysis_id,
        "user_id": result["rule_result"]["user_id"],
        "risk_score": result["rule_result"]["risk_score"],
        "risk_level": result["rule_result"]["risk_level"],
        "review_decision": result["review_decision"],
        "recommended_action": result["recommended_action"],
        # Placeholder: no analyst authentication is implemented yet.
        "reviewer_identity": None,
    }
    AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with AUDIT_PATH.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False) + "\n")


# ============================================================
# 11. FastAPI endpoints
# ============================================================

@app.get("/")
def home():
    return {
        "project": "IdentityShield AI",
        "message": "Identity security copilot is running",
        "version": "0.4.0",
        "model": MODEL_NAME,
        "decision_threshold": THRESHOLD,
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/profiles")
def list_profiles(
    current_user: dict[str, str] = Depends(get_current_user),
):
    return {
        "count": len(USER_PROFILES),
        "profiles": USER_PROFILES,
    }

@app.post("/analyze")
def analyze_access(
    event: AccessEvent,
    current_user: dict[str, str] = Depends(
        require_roles("admin", "analyst")
    ),
):
    analysis_id = str(uuid4())
    config = {"configurable": {"thread_id": analysis_id}}

    result = analysis_graph.invoke({"event": event}, config=config)
    interruptions = result.get("__interrupt__", [])

    if interruptions:
        review_request = interruptions[0].value
        return {
            "status": "awaiting_human_review",
            "analysis_id": analysis_id,
            **result.get("rule_result", {}),
            "ml_analysis": result.get("ml_result", {}),
            "recommended_action": "HUMAN_REVIEW_REQUIRED",
            "review_request": review_request,
            "disclaimer": (
                "Modèle entraîné sur des données synthétiques. "
                "Les résultats ne prouvent pas qu'une attaque réelle a eu lieu."
            ),
        }

    return {
        **result["rule_result"],
        "ml_analysis": result["ml_result"],
        "recommended_action": result["recommended_action"],
        "disclaimer": (
            "Modèle entraîné sur des données synthétiques. "
            "Les résultats ne prouvent pas qu'une attaque réelle a eu lieu."
        ),
    }

@app.post("/ask")
def ask_security_question(
    request: RAGQuestionRequest,
    current_user: dict[str, str] = Depends(
        require_roles("admin", "analyst")
    ),
):
    try:
        return answer_question(
            request.question,
            top_k=request.top_k,
        )

    except RuntimeError as exc:
        if "OPENROUTER_API_KEY" in str(exc):
            raise HTTPException(
                status_code=503,
                detail="Le service de génération n'est pas configuré.",
            ) from None

        raise HTTPException(
            status_code=503,
            detail="Le service de génération est indisponible.",
        ) from None

    except APIError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Le fournisseur LLM n'a pas traité la requête. "
                "Vérifiez la configuration du modèle et la disponibilité "
                "du service."
            ),
        ) from None



@app.post("/review")
def submit_human_review(
    request: ReviewDecisionRequest,
    current_user: dict[str, str] = Depends(
        require_roles("admin", "analyst")
    ),
):
    config = {"configurable": {"thread_id": request.analysis_id}}
    snapshot = analysis_graph.get_state(config)

    if not snapshot.values:
        raise HTTPException(status_code=404, detail="Analyse introuvable ou expirée.")
    if not snapshot.next:
        raise HTTPException(status_code=409, detail="Aucune revue humaine n'est en attente.")

    result = analysis_graph.invoke(Command(resume=request.decision), config=config)

    # Only write the audit entry if the graph really completed the review.
    if "review_decision" not in result or "recommended_action" not in result:
        raise HTTPException(
            status_code=409,
            detail="Le workflow n'a pas terminé la revue humaine.",
        )

    record_review_audit(request.analysis_id, result)

    return {
        "status": "review_completed",
        "user_id": result["rule_result"]["user_id"],
        "risk_score": result["rule_result"]["risk_score"],
        "risk_level": result["rule_result"]["risk_level"],
        "ml_analysis": result["ml_result"],
        "review_decision": result["review_decision"],
        "recommended_action": result["recommended_action"],
        "disclaimer": (
            "Modèle entraîné sur des données synthétiques. "
            "Les résultats ne prouvent pas qu'une attaque réelle a eu lieu."
        ),
    }


@app.get("/dashboard", include_in_schema=False)
def dashboard():
    return FileResponse(BASE_DIR / "dashboard.html")
