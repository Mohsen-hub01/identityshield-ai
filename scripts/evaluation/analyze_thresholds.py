
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import numpy as np
import pandas as pd

from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split


# ============================================================
# 1. CONFIGURATION
# ============================================================

DATA_PATH = BASE_DIR / "data" / "access_events.csv"
METRICS_PATH = BASE_DIR / "reports" / "model_metrics.json"
OUTPUT_DIR = BASE_DIR / "reports" / "threshold_selection"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_NAMES = ["LogisticRegression", "RandomForest"]

# Grille fine de seuils : 0.05 à 0.95.
THRESHOLDS = np.round(np.arange(0.05, 1.00, 0.05), 2)

# Tolérance utilisée pour identifier les F1 presque équivalents.
F1_TOLERANCE = 0.01


# ============================================================
# 2. CHARGER LES DONNEES ET LES MODELES
# ============================================================

df = pd.read_csv(DATA_PATH)

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

missing = [
    col for col in features + ["label"]
    if col not in df.columns
]

if missing:
    raise ValueError(f"Colonnes manquantes : {missing}")

X = df[features]
y = df["label"].astype(int)

with open(METRICS_PATH, "r", encoding="utf-8") as f:
    metrics = json.load(f)


# ============================================================
# 3. RECONSTRUIRE EXACTEMENT LA VALIDATION
# ============================================================

# Même découpage que train_model.py :
# 60 % train, 20 % validation, 20 % test.
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

# Important : X_test et y_test ne sont pas utilisés
# pour sélectionner le modèle ou son seuil.

print(f"Événements de validation : {len(X_val)}")
print(f"Événements suspects en validation : {(y_val == 1).sum()}")
print(f"Nombre de seuils testés : {len(THRESHOLDS)}")


# ============================================================
# 4. EVALUER LES SEUILS SUR LA VALIDATION
# ============================================================

all_results = {}
best_by_model = {}

for name in MODEL_NAMES:

    if name not in metrics:
        print(f"Modèle absent des métriques : {name}")
        continue

    model_path = Path(metrics[name]["model_path"])

    if not model_path.exists():
        print(f"Modèle introuvable : {model_path}")
        continue

    model = joblib.load(model_path)

    # Probabilités calculées uniquement sur la validation.
    probabilities = model.predict_proba(X_val)[:, 1]

    rows = []

    for threshold in THRESHOLDS:
        predictions = (probabilities >= threshold).astype(int)

        tn, fp, fn, tp = confusion_matrix(
            y_val,
            predictions,
            labels=[0, 1],
        ).ravel()

        rows.append({
            "model": name,
            "threshold": float(threshold),
            "accuracy": accuracy_score(y_val, predictions),
            "precision": precision_score(
                y_val, predictions, zero_division=0
            ),
            "recall": recall_score(
                y_val, predictions, zero_division=0
            ),
            "f1": f1_score(
                y_val, predictions, zero_division=0
            ),
            "FP": int(fp),
            "FN": int(fn),
            "TP": int(tp),
            "TN": int(tn),
        })

    results_df = pd.DataFrame(rows)

    # Exporter toutes les évaluations de validation.
    results_df.to_csv(
        OUTPUT_DIR / f"{name.lower()}_thresholds_validation.csv",
        index=False,
    )

    all_results[name] = results_df

    # Sélection principale : F1 maximal.
    # En cas d'égalité exacte : meilleure precision,
    # puis meilleur recall.
    ranked = results_df.sort_values(
        by=["f1", "precision", "recall", "threshold"],
        ascending=[False, False, False, False],
    )

    best = ranked.iloc[0].copy()

    best_by_model[name] = best

    # Afficher les seuils proches du meilleur F1.
    near_best = results_df[
        results_df["f1"] >= best["f1"] - F1_TOLERANCE
    ].sort_values(
        by=["FP", "FN", "precision"],
        ascending=[True, True, False],
    )

    print("\n" + "=" * 65)
    print(f"MODELE : {name}")
    print("=" * 65)

    print("\nMeilleur seuil selon le F1 :")
    print(f"Seuil     : {best['threshold']:.2f}")
    print(f"Precision : {best['precision']:.3f}")
    print(f"Recall    : {best['recall']:.3f}")
    print(f"F1-score  : {best['f1']:.3f}")
    print(f"FP        : {int(best['FP'])}")
    print(f"FN        : {int(best['FN'])}")

    print(
        f"\nConfigurations dont le F1 est à "
        f"{F1_TOLERANCE:.2f} maximum du meilleur :"
    )

    print(
        near_best[
            ["threshold", "precision", "recall", "f1", "FP", "FN"]
        ].to_string(index=False)
    )


# ============================================================
# 5. COMPARER LES MEILLEURES CONFIGURATIONS
# ============================================================

if not best_by_model:
    raise RuntimeError("Aucun modèle n'a pu être évalué.")

comparison = pd.DataFrame([
    row.to_dict()
    for row in best_by_model.values()
])

comparison = comparison.sort_values(
    by=["f1", "precision", "recall"],
    ascending=[False, False, False],
)

comparison.to_csv(
    OUTPUT_DIR / "model_comparison_validation.csv",
    index=False,
)

print("\n" + "=" * 65)
print("COMPARAISON FINALE SUR LA VALIDATION")
print("=" * 65)

print(
    comparison[
        ["model", "threshold", "precision", "recall",
         "f1", "FP", "FN"]
    ].to_string(index=False)
)

winner = comparison.iloc[0]

selection = {
    "selection_method": (
        "Maximum F1 on validation; ties resolved by "
        "precision, then recall, then higher threshold"
    ),
    "validation_only": True,
    "selected_model": str(winner["model"]),
    "selected_threshold": float(winner["threshold"]),
    "validation_metrics": {
        "precision": float(winner["precision"]),
        "recall": float(winner["recall"]),
        "f1": float(winner["f1"]),
        "accuracy": float(winner["accuracy"]),
        "FP": int(winner["FP"]),
        "FN": int(winner["FN"]),
        "TP": int(winner["TP"]),
        "TN": int(winner["TN"]),
    },
    "f1_tolerance_for_review": F1_TOLERANCE,
    "test_evaluated": False,
}

with open(
    OUTPUT_DIR / "selected_configuration.json",
    "w",
    encoding="utf-8",
) as f:
    json.dump(selection, f, indent=4, ensure_ascii=False)

print("\n" + "=" * 65)
print("CONFIGURATION RETENUE PROVISOIREMENT")
print("=" * 65)
print(f"Modèle : {selection['selected_model']}")
print(f"Seuil  : {selection['selected_threshold']:.2f}")
print("Décision basée uniquement sur la validation.")
print(f"Résultats enregistrés dans : {OUTPUT_DIR}")
print("Le jeu de test n'a pas été évalué.")
