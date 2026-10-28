from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = BASE_DIR / "data" / "access_events.csv"
OUTPUT_DIR = BASE_DIR / "reports" / "figures"

df = pd.read_csv(DATA_PATH)
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

labels = {0: "Normal", 1: "Suspect"}
colors = ["#2E86DE", "#E74C3C"]

# 1. Moyenne des tentatives échouées
failed_means = df.groupby("label")["failed_attempts"].mean()
failed_means.index = failed_means.index.map(labels)

plt.figure(figsize=(7, 5))
failed_means.plot(kind="bar", color=colors)
plt.title("Tentatives échouées selon le type d'événement")
plt.xlabel("Type d'événement")
plt.ylabel("Moyenne des tentatives échouées")
plt.xticks(rotation=0)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "failed_attempts.png", dpi=150)
plt.close()

# 2. Distribution des scores de risque IP
plt.figure(figsize=(7, 5))
for label, name, color in zip([0, 1], ["Normal", "Suspect"], colors):
    df.loc[df["label"] == label, "ip_risk_score"].plot(
        kind="hist",
        bins=20,
        alpha=0.55,
        label=name,
        color=color,
    )

plt.title("Distribution des scores de risque IP")
plt.xlabel("Score de risque IP")
plt.ylabel("Nombre d'événements")
plt.legend()
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "ip_risk_score.png", dpi=150)
plt.close()

# 3. Pourcentage de nouveaux appareils
device_table = pd.crosstab(
    df["label"], df["new_device"], normalize="index"
) * 100
device_table.index = device_table.index.map(labels)
device_table = device_table.rename(
    columns={0: "Appareil connu", 1: "Nouvel appareil"}
)

device_table.plot(kind="bar", stacked=True, figsize=(7, 5))
plt.title("Appareils connus et nouveaux selon le type d'événement")
plt.xlabel("Type d'événement")
plt.ylabel("Pourcentage (%)")
plt.xticks(rotation=0)
plt.legend(title="Type d'appareil")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "new_devices.png", dpi=150)
plt.close()

# 4. Répartition des pays selon le type d'événement
country_table = pd.crosstab(df["country"], df["label"])
country_table = country_table.rename(columns=labels)

country_table.plot(kind="bar", figsize=(10, 6), color=colors)
plt.title("Nombre d'événements par pays")
plt.xlabel("Pays")
plt.ylabel("Nombre d'événements")
plt.xticks(rotation=35, ha="right")
plt.legend(title="Type d'événement")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "countries.png", dpi=150)
plt.close()

print("Visualisations terminées !")
print(f"Graphiques enregistrés dans : {OUTPUT_DIR}")
