
from pathlib import Path

import numpy as np
import pandas as pd


# Reproductibilité : mêmes données à chaque exécution
RANDOM_SEED = 42
N_EVENTS = 5_000

rng = np.random.default_rng(RANDOM_SEED)

COUNTRIES = [
    "France",
    "Belgique",
    "Espagne",
    "Allemagne",
    "Maroc",
    "Royaume-Uni",
    "États-Unis",
]

# Profils entièrement fictifs
USER_IDS = [f"user_{i:03d}" for i in range(1, 101)]

# Scénarios simulés : 12 % d'événements suspects en moyenne.
# Le label représente le scénario généré, pas une vérité réelle.
label = rng.binomial(1, 0.32, size=N_EVENTS)

# Variables de connexion
hours = np.empty(N_EVENTS, dtype=int)
countries = np.empty(N_EVENTS, dtype=object)
failed_attempts = np.empty(N_EVENTS, dtype=int)
new_device = np.empty(N_EVENTS, dtype=int)
ip_risk_score = np.empty(N_EVENTS, dtype=int)
impossible_travel = np.empty(N_EVENTS, dtype=int)

for i, is_suspicious in enumerate(label):

    if is_suspicious:
        # Événement suspect : signaux plus fréquents,
        # mais pas systématiques.
        hours[i] = (
            rng.integers(0, 6)
            if rng.random() < 0.55
            else rng.integers(6, 24)
        )

        countries[i] = (
            rng.choice(COUNTRIES[1:])
            if rng.random() < 0.65
            else "France"
        )

        failed_attempts[i] = min(
            rng.poisson(3), 15
        )

        new_device[i] = rng.binomial(1, 0.65)
        ip_risk_score[i] = rng.integers(35, 101)
        impossible_travel[i] = rng.binomial(1, 0.30)

    else:
        # Événement normal : comportement plus habituel,
        # avec quelques anomalies possibles.
        hours[i] = (
            int(np.clip(rng.normal(13, 4), 0, 23))
        )

        countries[i] = (
            "France"
            if rng.random() < 0.80
            else rng.choice(COUNTRIES[1:])
        )

        failed_attempts[i] = min(
            rng.poisson(0.4), 5
        )

        new_device[i] = rng.binomial(1, 0.08)
        ip_risk_score[i] = min(
            int(rng.beta(2, 8) * 100), 100
        )
        impossible_travel[i] = rng.binomial(1, 0.01)


# Construire le dataset
df = pd.DataFrame({
    "event_id": [f"evt_{i:05d}" for i in range(1, N_EVENTS + 1)],
    "user_id": rng.choice(USER_IDS, size=N_EVENTS),
    "country": countries,
    "hour": hours,
    "failed_attempts": failed_attempts,
    "new_device": new_device,
    "ip_risk_score": ip_risk_score,
    "impossible_travel": impossible_travel,
    "label": label,
})

# Créer le dossier de sortie s'il n'existe pas
output_path = Path("data") / "access_events.csv"
output_path.parent.mkdir(parents=True, exist_ok=True)

df.to_csv(output_path, index=False)

print("Dataset généré avec succès !")
print(f"Fichier : {output_path.resolve()}")
print(f"Nombre d'événements : {len(df)}")
print(f"Nombre de variables : {len(df.columns)}")

print("\nRépartition des labels :")
print(
    df["label"]
    .value_counts()
    .sort_index()
    .rename(index={0: "Normal", 1: "Suspect"})
)

print("\nAperçu des données :")
print(df.head())

print("\nValeurs manquantes :")
print(df.isnull().sum())
