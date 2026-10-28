from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "access_events.csv"

df = pd.read_csv(DATA_PATH)

print("=" * 50)
print("1. DIMENSIONS DU DATASET")
print("=" * 50)
print(f"Nombre de lignes : {df.shape[0]}")
print(f"Nombre de colonnes : {df.shape[1]}")

print("\n" + "=" * 50)
print("2. TYPES DE DONNÉES")
print("=" * 50)
print(df.dtypes)

print("\n" + "=" * 50)
print("3. VALEURS MANQUANTES")
print("=" * 50)
print(df.isnull().sum())

print("\n" + "=" * 50)
print("4. DOUBLONS")
print("=" * 50)
print(f"Lignes entièrement dupliquées : {df.duplicated().sum()}")
print(f"event_id dupliqués : {df['event_id'].duplicated().sum()}")

print("\n" + "=" * 50)
print("5. VALEURS HORS LIMITES")
print("=" * 50)

checks = {
    "hour hors de [0, 23]": ~df["hour"].between(0, 23),
    "failed_attempts négatif": df["failed_attempts"] < 0,
    "ip_risk_score hors de [0, 100]": ~df["ip_risk_score"].between(0, 100),
    "new_device invalide": ~df["new_device"].isin([0, 1]),
    "impossible_travel invalide": ~df["impossible_travel"].isin([0, 1]),
    "label invalide": ~df["label"].isin([0, 1]),
}

for name, invalid in checks.items():
    print(f"{name} : {invalid.sum()}")

print("\n" + "=" * 50)
print("6. DISTRIBUTION DES LABELS")
print("=" * 50)
print(df["label"].value_counts().rename(index={0: "Normal", 1: "Suspect"}))

print("\nPourcentages :")
print(
    (df["label"].value_counts(normalize=True) * 100)
    .rename(index={0: "Normal", 1: "Suspect"})
    .round(2)
)

print("\n" + "=" * 50)
print("7. STATISTIQUES DES VARIABLES NUMÉRIQUES")
print("=" * 50)
print(
    df[
        [
            "hour",
            "failed_attempts",
            "ip_risk_score",
            "new_device",
            "impossible_travel",
        ]
    ].describe().round(2)
)

print("\n" + "=" * 50)
print("8. IDENTIFIANTS")
print("=" * 50)
print(f"user_id uniques : {df['user_id'].nunique()}")
print(f"event_id uniques : {df['event_id'].nunique()}")

print("\nValidation terminée.")
