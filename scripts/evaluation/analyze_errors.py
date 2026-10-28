
import json
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import pandas as pd

from sklearn.metrics import confusion_matrix
from sklearn.model_selection import train_test_split


# ============================================================
# 1. CONFIGURATION ET CHARGEMENT DES DONNEES
# ============================================================

DATA_PATH = BASE_DIR / "data" / "access_events.csv"
METRICS_PATH = BASE_DIR / "reports" / "model_metrics.json"
OUTPUT_DIR = BASE_DIR / "reports" / "error_analysis"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

df = pd.read_csv(DATA_PATH)

# Les 8 variables utilisees lors de l'entrainement.
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

# Verifier que les colonnes attendues existent.
missing_columns = [
    column for column in features + ["label"]
    if column not in df.columns
]

if missing_columns:
    raise ValueError(
        f"Colonnes manquantes dans {DATA_PATH} : {missing_columns}"
    )

X = df[features]
y = df["label"]

with open(METRICS_PATH, "r", encoding="utf-8") as file:
    metrics = json.load(file)


# ============================================================
# 2. RECONSTRUIRE LE MEME JEU DE TEST
# ============================================================

# Meme separation que dans train_model.py :
# 60 % entrainement, 20 % validation, 20 % test.

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

print(f"Evenements dans le jeu de test : {len(X_test)}")
print("Analyse effectuee sur le jeu de test existant.")


# ============================================================
# 3. ANALYSER CHAQUE MODELE
# ============================================================

model_names = ["LogisticRegression", "RandomForest"]

numeric_features = [
    "hour",
    "failed_attempts",
    "new_device",
    "ip_risk_score",
    "impossible_travel",
    "country_unusual",
    "hour_unusual",
]

for name in model_names:

    if name not in metrics:
        print(f"\nModele absent des resultats : {name}")
        continue

    print("\n" + "=" * 65)
    print(f"ANALYSE DES ERREURS : {name}")
    print("=" * 65)

    model_path = Path(metrics[name]["model_path"])
    if not model_path.is_absolute():
        model_path = BASE_DIR / model_path

    if not model_path.exists():
        print(f"Fichier modele introuvable : {model_path}")
        continue

    model = joblib.load(model_path)

    # Utiliser le seuil selectionne pendant l'entrainement.
    threshold = float(metrics[name]["selected_threshold"])

    # Calcul des probabilites de la classe Suspect.
    probabilities = model.predict_proba(X_test)[:, 1]

    predictions = (probabilities >= threshold).astype(int)

    # --------------------------------------------------------
    # 3A. CONSTRUIRE LE TABLEAU DES PREDICTIONS
    # --------------------------------------------------------

    results = X_test.copy()

    results["actual_label"] = y_test.to_numpy()
    results["predicted_label"] = predictions
    results["suspect_probability"] = probabilities
    results["threshold"] = threshold

    results["error_type"] = "Correct"

    results.loc[
        (results["actual_label"] == 0)
        & (results["predicted_label"] == 1),
        "error_type",
    ] = "False Positive"

    results.loc[
        (results["actual_label"] == 1)
        & (results["predicted_label"] == 0),
        "error_type",
    ] = "False Negative"

    results.loc[
        (results["actual_label"] == 0)
        & (results["predicted_label"] == 0),
        "error_type",
    ] = "True Negative"

    results.loc[
        (results["actual_label"] == 1)
        & (results["predicted_label"] == 1),
        "error_type",
    ] = "True Positive"

    # --------------------------------------------------------
    # 3B. MATRICE DE CONFUSION
    # --------------------------------------------------------

    tn, fp, fn, tp = confusion_matrix(
        y_test,
        predictions,
        labels=[0, 1],
    ).ravel()

    print(f"Seuil utilise : {threshold:.2f}")
    print(f"Vrais negatifs  : {tn}")
    print(f"Faux positifs   : {fp}")
    print(f"Faux negatifs   : {fn}")
    print(f"Vrais positifs  : {tp}")

    print("\nRepartition des types de prediction :")
    print(results["error_type"].value_counts().to_string())

    # --------------------------------------------------------
    # 4. COMPARER LES CARACTERISTIQUES DES ERREURS
    # --------------------------------------------------------

    print("\nMoyennes des variables numeriques par type :")

    summary = results.groupby("error_type")[
        numeric_features + ["suspect_probability"]
    ].mean().round(2)

    print(summary.to_string())

    # --------------------------------------------------------
    # 4A. PAYS FREQUENTS PARMI LES FAUX POSITIFS
    # --------------------------------------------------------

    false_positives = results[
        results["error_type"] == "False Positive"
    ].copy()

    print("\nPays les plus frequents parmi les faux positifs :")

    if not false_positives.empty:
        print(
            false_positives["country"]
            .value_counts()
            .head(10)
            .to_string()
        )
    else:
        print("Aucun faux positif.")

    # --------------------------------------------------------
    # 4B. PAYS FREQUENTS PARMI LES FAUX NEGATIFS
    # --------------------------------------------------------

    false_negatives = results[
        results["error_type"] == "False Negative"
    ].copy()

    print("\nPays les plus frequents parmi les faux negatifs :")

    if not false_negatives.empty:
        print(
            false_negatives["country"]
            .value_counts()
            .head(10)
            .to_string()
        )
    else:
        print("Aucun faux negatif.")



    # --------------------------------------------------------
    # 4C. TAUX DE FAUX NEGATIFS PAR PAYS
    # --------------------------------------------------------

    print("\nTaux de faux negatifs par pays :")

    country_analysis = results.groupby("country").apply(
        lambda group: pd.Series({
            "total_suspects": int(
                (group["actual_label"] == 1).sum()
            ),
            "false_negatives": int(
                (
                    (group["actual_label"] == 1)
                    & (group["predicted_label"] == 0)
                ).sum()
            ),
        }),
        include_groups=False,
    )

    country_analysis["false_negative_rate"] = (
        country_analysis["false_negatives"]
        / country_analysis["total_suspects"].replace(0, float("nan"))
    )

    country_analysis = country_analysis.sort_values(
        "false_negative_rate",
        ascending=False,
    )

    print(country_analysis.round(3).to_string())

    country_analysis.to_csv(
        OUTPUT_DIR / f"{name.lower()}_country_error_rates.csv"
    )


    # --------------------------------------------------------
    # 5. EXPORTER LES RESULTATS
    # --------------------------------------------------------

    results.to_csv(
        OUTPUT_DIR / f"{name.lower()}_all_predictions.csv",
        index=False,
    )

    false_positives.to_csv(
        OUTPUT_DIR / f"{name.lower()}_false_positives.csv",
        index=False,
    )

    false_negatives.to_csv(
        OUTPUT_DIR / f"{name.lower()}_false_negatives.csv",
        index=False,
    )

    summary.to_csv(
        OUTPUT_DIR / f"{name.lower()}_error_summary.csv"
    )

    print(f"\nFichiers exportes dans : {OUTPUT_DIR}")

print("\nAnalyse terminee.")
