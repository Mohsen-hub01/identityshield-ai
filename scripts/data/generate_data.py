
from pathlib import Path

import numpy as np
import pandas as pd

# ============================================================
# 1. CONFIGURATION
# ============================================================

RANDOM_SEED = 42
N_EVENTS = 5_000
N_USERS = 100

rng = np.random.default_rng(RANDOM_SEED)

COUNTRIES = [
    "France", "Belgique", "Espagne", "Allemagne",
    "Maroc", "Royaume-Uni", "États-Unis",
]

USER_IDS = [f"user_{i:03d}" for i in range(1, N_USERS + 1)]

# Profil habituel simulé de chaque utilisateur.
user_home_country = {
    uid: rng.choice(
        COUNTRIES,
        p=[0.70, 0.06, 0.06, 0.05, 0.05, 0.04, 0.04],
    )
    for uid in USER_IDS
}

user_usual_hour = {
    uid: int(np.clip(rng.normal(13, 3), 7, 19))
    for uid in USER_IDS
}

# Sauvegarde des profils habituels pour l'API
profiles_df = pd.DataFrame({
    "user_id": USER_IDS,
    "home_country": [
        user_home_country[uid] for uid in USER_IDS
    ],
    "usual_hour": [
        user_usual_hour[uid] for uid in USER_IDS
    ],
})

profiles_path = Path("data") / "user_profiles.csv"
profiles_path.parent.mkdir(parents=True, exist_ok=True)
profiles_df.to_csv(profiles_path, index=False, encoding="utf-8")

# ============================================================
# 2. GENERATION DES EVENEMENTS
# ============================================================

user_id = rng.choice(USER_IDS, size=N_EVENTS)

scenario = rng.choice(
    ["routine", "benign_variation", "suspicious"],
    size=N_EVENTS,
    p=[0.72, 0.18, 0.10],
)

country = []
hour = []
failed_attempts = []
new_device = rng.binomial(1, 0.18, size=N_EVENTS)
ip_risk_score = []
impossible_travel = []

for i, uid in enumerate(user_id):
    home = user_home_country[uid]
    usual_hour = user_usual_hour[uid]

    if scenario[i] == "routine":
        c = home
        h = int(np.clip(rng.normal(usual_hour, 2), 0, 23))
        failures = min(rng.poisson(0.5), 15)
        ip_score = int(rng.beta(2.0, 5.0) * 100)
        travel = 0

    elif scenario[i] == "benign_variation":
        # Une variation inhabituelle n'est pas nécessairement une attaque.
        c = rng.choice(COUNTRIES)
        h = int(rng.integers(0, 24))
        failures = min(rng.poisson(1.2), 15)
        ip_score = int(rng.beta(2.2, 3.8) * 100)
        travel = int(rng.random() < 0.005)

    else:
        # Signaux suspects, sans rendre chaque variable extrême.
        c = rng.choice([x for x in COUNTRIES if x != home])
        h = int(rng.integers(0, 24))
        failures = min(rng.poisson(2.5), 15)
        ip_score = int(rng.beta(3.0, 2.2) * 100)
        travel = int(rng.random() < 0.20)

    country.append(c)
    hour.append(h)
    failed_attempts.append(failures)
    ip_risk_score.append(ip_score)
    impossible_travel.append(travel)

country = np.array(country)
hour = np.array(hour)
failed_attempts = np.array(failed_attempts)
ip_risk_score = np.array(ip_risk_score)
impossible_travel = np.array(impossible_travel)

# ============================================================
# 3. LABELS SIMULES
# ============================================================
# Ce ne sont pas des attaques confirmées.
# Les labels sont générés à partir des signaux disponibles,
# avec du bruit pour représenter une certaine incertitude.

unusual_country = np.array([
    country[i] != user_home_country[user_id[i]]
    for i in range(N_EVENTS)
])

unusual_hour = np.array([
    abs(hour[i] - user_usual_hour[user_id[i]]) >= 6
    for i in range(N_EVENTS)
])

risk_signal = (
    1.2 * (ip_risk_score >= 60)
    + 1.0 * (failed_attempts >= 3)
    + 0.7 * new_device
    + 0.8 * unusual_country
    + 0.6 * unusual_hour
    + 2.0 * impossible_travel
)

scenario_bonus = np.where(scenario == "suspicious", 1.0, 0.0)
noise = rng.normal(0, 0.8, size=N_EVENTS)

logit = -2.0 + risk_signal + scenario_bonus + noise
probability_suspicious = 1 / (1 + np.exp(-logit))

label = rng.binomial(1, probability_suspicious, size=N_EVENTS)

# ============================================================
# 4. DATAFRAME ET EXPORT
# ============================================================

df = pd.DataFrame({
    "event_id": [
        f"evt_{i:05d}" for i in range(1, N_EVENTS + 1)
    ],
    "user_id": user_id,
    "country": country,
    "hour": hour,
    "failed_attempts": failed_attempts,
    "new_device": new_device,
    "ip_risk_score": ip_risk_score,
    "impossible_travel": impossible_travel,
    "country_unusual": unusual_country.astype(int),
    "hour_unusual": unusual_hour.astype(int),
    "label": label,
})

output_path = Path("data") / "access_events.csv"
output_path.parent.mkdir(parents=True, exist_ok=True)
df.to_csv(output_path, index=False)

# ============================================================
# 5. RAPPORT
# ============================================================

print("Dataset synthétique généré.")
print(f"Fichier : {output_path.resolve()}")
print(f"Nombre d'événements : {len(df)}")
print(f"Nombre d'utilisateurs : {df['user_id'].nunique()}")

print("\nRépartition des labels (0=Normal, 1=Suspect) :")
print(df["label"].value_counts().sort_index())

print(f"\nPourcentage suspect simulé : {df['label'].mean() * 100:.2f} %")

print("\nValeurs manquantes :")
print(df.isnull().sum())

print("\nAperçu :")
print(df.head())
