
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import pandas as pd

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


# ============================================================
# 1. CHARGEMENT DES DONNEES
# ============================================================

df = pd.read_csv(BASE_DIR / "data" / "access_events.csv")

features = [
    "country",
    "hour",
    "failed_attempts",
    "new_device",
    "ip_risk_score",
    "impossible_travel",
    "country_unusual",
    "hour_unusual",
]

X = df[features]
y = df["label"]

print(f"Nombre total d'evenements : {len(df)}")
print("Repartition des labels :")
print(y.value_counts().sort_index())


# ============================================================
# 2. SEPARATION : 60 % / 20 % / 20 %
# ============================================================

# 60 % pour l'entrainement, 40 % temporairement.
X_train, X_temp, y_train, y_temp = train_test_split(
    X,
    y,
    test_size=0.40,
    random_state=42,
    stratify=y,
)

# Partager les 40 % restants en validation et test.
X_val, X_test, y_val, y_test = train_test_split(
    X_temp,
    y_temp,
    test_size=0.50,
    random_state=42,
    stratify=y_temp,
)

print("\nRepartition des donnees :")
print(f"Entrainement : {len(X_train)}")
print(f"Validation   : {len(X_val)}")
print(f"Test final   : {len(X_test)}")


# ============================================================
# 3. PREPARATION DES VARIABLES
# ============================================================

categorical_features = ["country"]

numeric_features = [
    "hour",
    "failed_attempts",
    "new_device",
    "ip_risk_score",
    "impossible_travel",
    "country_unusual",
    "hour_unusual",
]

preprocessor = ColumnTransformer(
    transformers=[
        (
            "categorical",
            OneHotEncoder(handle_unknown="ignore"),
            categorical_features,
        ),
        (
            "numeric",
            Pipeline(
                steps=[
                    ("imputer", SimpleImputer(strategy="median")),
                    ("scaler", StandardScaler()),
                ]
            ),
            numeric_features,
        ),
    ]
)


# ============================================================
# 4. DEFINITION DES MODELES ET DES SEUILS
# ============================================================

models = {
    "LogisticRegression": LogisticRegression(
        max_iter=1000,
        random_state=42,
        class_weight="balanced",
    ),
    "RandomForest": RandomForestClassifier(
        n_estimators=200,
        random_state=42,
        class_weight="balanced",
    ),
}

THRESHOLDS = [0.20, 0.35, 0.50, 0.65, 0.80]
TARGET_RECALL = 0.80
MIN_RECALL_FOR_PRECISION = 0.60


# ============================================================
# 5. FONCTIONS D'EVALUATION
# ============================================================

def evaluate_model(y_true, probabilities, threshold):
    """
    Convertit les probabilites en predictions avec un seuil
    et calcule les metriques de classification.
    """

    predictions = (probabilities >= threshold).astype(int)

    tn, fp, fn, tp = confusion_matrix(
        y_true,
        predictions,
        labels=[0, 1],
    ).ravel()

    return {
        "threshold": float(threshold),
        "accuracy": round(
            accuracy_score(y_true, predictions), 4
        ),
        "precision": round(
            precision_score(
                y_true,
                predictions,
                zero_division=0,
            ),
            4,
        ),
        "recall": round(
            recall_score(
                y_true,
                predictions,
                zero_division=0,
            ),
            4,
        ),
        "f1_score": round(
            f1_score(
                y_true,
                predictions,
                zero_division=0,
            ),
            4,
        ),
        "true_negatives": int(tn),
        "false_positives": int(fp),
        "false_negatives": int(fn),
        "true_positives": int(tp),
    }


def select_threshold(y_true, probabilities):
    """
    Compare trois strategies de selection du seuil.
    Toutes les decisions sont prises sur la validation.
    """

    validation_results = {}

    for threshold in THRESHOLDS:
        validation_results[str(threshold)] = evaluate_model(
            y_true,
            probabilities,
            threshold,
        )

    # Strategie 1 : seuil le plus eleve avec recall >= 80 %.
    eligible_recall = [
        threshold
        for threshold in THRESHOLDS
        if validation_results[str(threshold)]["recall"]
        >= TARGET_RECALL
    ]

    if eligible_recall:
        threshold_recall = max(eligible_recall)
    else:
        threshold_recall = max(
            THRESHOLDS,
            key=lambda threshold: (
                validation_results[str(threshold)]["recall"],
                threshold,
            ),
        )

    # Strategie 2 : meilleur F1-score.
    threshold_f1 = max(
        THRESHOLDS,
        key=lambda threshold: (
            validation_results[str(threshold)]["f1_score"],
            threshold,
        ),
    )

    # Strategie 3 : meilleure precision avec recall >= 60 %.
    eligible_precision = [
        threshold
        for threshold in THRESHOLDS
        if validation_results[str(threshold)]["recall"]
        >= MIN_RECALL_FOR_PRECISION
    ]

    if eligible_precision:
        threshold_precision = max(
            eligible_precision,
            key=lambda threshold: (
                validation_results[str(threshold)]["precision"],
                threshold,
            ),
        )
    else:
        # Si aucun seuil n'atteint 60 % de recall,
        # choisir celui qui maximise le recall.
        threshold_precision = max(
            THRESHOLDS,
            key=lambda threshold: (
                validation_results[str(threshold)]["recall"],
                validation_results[str(threshold)]["precision"],
            ),
        )

    strategies = {
        "recall_target": {
            "threshold": float(threshold_recall),
            "metrics": validation_results[str(threshold_recall)],
        },
        "best_f1": {
            "threshold": float(threshold_f1),
            "metrics": validation_results[str(threshold_f1)],
        },
        "precision_with_min_recall": {
            "threshold": float(threshold_precision),
            "metrics": validation_results[str(threshold_precision)],
        },
    }

    return strategies, validation_results


# ============================================================
# 6. ENTRAINEMENT ET SELECTION DU SEUIL
# ============================================================

results = {}

Path("models").mkdir(exist_ok=True)
Path("reports").mkdir(exist_ok=True)

for name, classifier in models.items():

    print("\n" + "=" * 60)
    print(f"MODELE : {name}")
    print("=" * 60)

    pipeline = Pipeline(
        steps=[
            ("preprocessor", clone(preprocessor)),
            ("classifier", classifier),
        ]
    )

    # A. Entrainement sur les donnees d'entrainement.
    pipeline.fit(X_train, y_train)

    # B. Selection du seuil sur les donnees de validation.
    val_probabilities = pipeline.predict_proba(X_val)[:, 1]

    strategies, validation_results = select_threshold(
        y_val,
        val_probabilities,
    )

    print("\nCOMPARAISON DES STRATEGIES SUR LA VALIDATION")

    for strategy_name, strategy in strategies.items():
        metrics = strategy["metrics"]

        print(
            f"\nStrategie : {strategy_name}"
            f"\n  Seuil     : {strategy['threshold']:.2f}"
            f"\n  Precision : {metrics['precision']:.4f}"
            f"\n  Recall    : {metrics['recall']:.4f}"
            f"\n  F1-score  : {metrics['f1_score']:.4f}"
            f"\n  FP        : {metrics['false_positives']}"
            f"\n  FN        : {metrics['false_negatives']}"
        )

    # Pour cette premiere comparaison, retenir le meilleur F1-score.
    selected_threshold = strategies["best_f1"]["threshold"]
    reason = "Meilleur F1-score sur la validation"

    print("\nComparaison des seuils sur la VALIDATION :")

    validation_df = pd.DataFrame.from_dict(
        validation_results,
        orient="index",
    )

    print(
        validation_df[
            [
                "accuracy",
                "precision",
                "recall",
                "f1_score",
                "false_positives",
                "false_negatives",
                "true_positives",
            ]
        ].to_string()
    )

    print(f"\nSeuil retenu : {selected_threshold:.2f}")
    print(f"Raison : {reason}")

    # C. Evaluation finale sur le jeu de test.
    # Le test n'est pas utilise pour choisir le seuil.
    test_probabilities = pipeline.predict_proba(X_test)[:, 1]

    final_metrics = evaluate_model(
        y_test,
        test_probabilities,
        selected_threshold,
    )

    test_predictions = (
        test_probabilities >= selected_threshold
    ).astype(int)

    print("\nRESULTATS FINAUX SUR LE TEST :")
    print(f"Seuil utilise : {selected_threshold:.2f}")

    print(
        classification_report(
            y_test,
            test_predictions,
            labels=[0, 1],
            target_names=["Normal", "Suspect"],
            zero_division=0,
        )
    )

    print("Matrice de confusion :")

    print(
        confusion_matrix(
            y_test,
            test_predictions,
            labels=[0, 1],
        )
    )

    average_precision = average_precision_score(
        y_test,
        test_probabilities,
    )

    final_metrics["average_precision"] = round(
        average_precision, 4
    )

    # Reference supplementaire avec le seuil standard de 0.50.
    baseline_metrics = evaluate_model(
        y_test,
        test_probabilities,
        0.50,
    )

    # Sauvegarde du pipeline entraine.
    model_path = BASE_DIR / "models" / f"{name.lower()}.joblib"
    joblib.dump(pipeline, model_path)

    # Enregistrer les resultats propres a chaque modele.
    results[name] = {
        "selected_threshold": float(selected_threshold),
        "threshold_selection_reason": reason,
        "target_recall": TARGET_RECALL,
        "validation_threshold_analysis": validation_results,
        "threshold_strategies": strategies,
        "final_test_metrics": final_metrics,
        "test_metrics_at_threshold_0_50": baseline_metrics,
        "model_path": str(model_path),
    }

    print(
        f"\nAverage Precision sur le test : "
        f"{average_precision:.4f}"
    )
    print(f"Modele sauvegarde : {model_path}")


# ============================================================
# 7. SAUVEGARDE DES RESULTATS
# ============================================================

metrics_path = BASE_DIR / "reports" / "model_metrics.json"

with open(metrics_path, "w", encoding="utf-8") as file:
    json.dump(
        results,
        file,
        indent=4,
        ensure_ascii=False,
    )

print("\n" + "=" * 60)
print("EVALUATION TERMINEE")
print(f"Resultats : {metrics_path}")
print("Modeles : models/")
print("=" * 60)
