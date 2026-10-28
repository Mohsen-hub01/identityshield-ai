
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import pandas as pd
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

DATA_PATH = BASE_DIR / "data" / "access_events.csv"
CONFIG_PATH = BASE_DIR / "reports" / "threshold_selection" / "selected_configuration.json"
OUTPUT_DIR = BASE_DIR / "reports" / "final_evaluation"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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

# 1. Lire la configuration déjà choisie sur la validation.
with CONFIG_PATH.open("r", encoding="utf-8") as f:
    config = json.load(f)

if not config.get("validation_only", False):
    raise ValueError("La configuration n'est pas marquée validation_only.")

if config.get("test_evaluated", True):
    raise ValueError("La configuration indique que le test a déjà été évalué.")

model_name = config["selected_model"]
threshold = float(config["selected_threshold"])

MODEL_PATHS = {
    "LogisticRegression": BASE_DIR / "models" / "logisticregression.joblib",
    "RandomForest": BASE_DIR / "models" / "randomforest.joblib",
}

if model_name not in MODEL_PATHS:
    raise ValueError(f"Modèle non reconnu : {model_name}")

model = joblib.load(MODEL_PATHS[model_name])

# 2. Reconstituer exactement le découpage utilisé à l'entraînement.
df = pd.read_csv(DATA_PATH)

missing = [col for col in FEATURES + ["label"] if col not in df.columns]
if missing:
    raise ValueError(f"Colonnes manquantes : {missing}")

X = df[FEATURES]
y = df["label"].astype(int)

X_train, X_temp, y_train, y_temp = train_test_split(
    X,
    y,
    test_size=0.40,
    random_state=42,
    stratify=y,
)

X_val, X_test, y_val, y_test = train_test_split(
    X_temp,
    y_temp,
    test_size=0.50,
    random_state=42,
    stratify=y_temp,
)

# 3. Évaluer une seule fois la configuration sur le jeu de test.
probabilities = model.predict_proba(X_test)[:, 1]
predictions = (probabilities >= threshold).astype(int)

tn, fp, fn, tp = confusion_matrix(
    y_test, predictions, labels=[0, 1]
).ravel()

results = {
    "model": model_name,
    "threshold": threshold,
    "test_evaluated": True,
    "test_size": int(len(y_test)),
    "test_positive_count": int(y_test.sum()),
    "accuracy": float(accuracy_score(y_test, predictions)),
    "precision": float(precision_score(
        y_test, predictions, zero_division=0
    )),
    "recall": float(recall_score(
        y_test, predictions, zero_division=0
    )),
    "f1": float(f1_score(
        y_test, predictions, zero_division=0
    )),
    "average_precision": float(
        average_precision_score(y_test, probabilities)
    ),
    "TN": int(tn),
    "FP": int(fp),
    "FN": int(fn),
    "TP": int(tp),
}

print("\n=== ÉVALUATION FINALE — JEU DE TEST ===")
print(f"Modèle      : {model_name}")
print(f"Seuil       : {threshold:.2f}")
print(f"Taille test : {len(y_test)}")
print(f"Accuracy    : {results['accuracy']:.3f}")
print(f"Precision   : {results['precision']:.3f}")
print(f"Recall      : {results['recall']:.3f}")
print(f"F1-score    : {results['f1']:.3f}")
print(f"AP          : {results['average_precision']:.3f}")
print(f"TN={tn} | FP={fp} | FN={fn} | TP={tp}")

print("\n=== RAPPORT DE CLASSIFICATION ===")
print(classification_report(
    y_test,
    predictions,
    labels=[0, 1],
    target_names=["normal", "suspect"],
    zero_division=0,
))

output_path = OUTPUT_DIR / "final_test_metrics.json"
with output_path.open("w", encoding="utf-8") as f:
    json.dump(results, f, indent=4, ensure_ascii=False)

print(f"Résultats enregistrés dans : {output_path}")
print("Le seuil n'a pas été ajusté sur le jeu de test.")
