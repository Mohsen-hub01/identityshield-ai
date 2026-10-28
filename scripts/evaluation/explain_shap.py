
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import pandas as pd
import shap

# 1. Charger le modèle entraîné
model = joblib.load(BASE_DIR / "models" / "randomforest.joblib")

# 2. Définir la connexion à analyser
event = {
    "country": "Maroc",
    "hour": 2,
    "failed_attempts": 5,
    "new_device": 1,
    "ip_risk_score": 85,
    "impossible_travel": 1,
}

features = [
    "country",
    "hour",
    "failed_attempts",
    "new_device",
    "ip_risk_score",
    "impossible_travel",
]

X_event = pd.DataFrame([event], columns=features)

# 3. Appliquer le prétraitement du modèle
preprocessor = model.named_steps["preprocessor"]
classifier = model.named_steps["classifier"]

X_transformed = preprocessor.transform(X_event)
feature_names = preprocessor.get_feature_names_out()

# Certaines versions de SHAP nécessitent un tableau dense
if hasattr(X_transformed, "toarray"):
    X_transformed = X_transformed.toarray()

# 4. Calculer les contributions SHAP
explainer = shap.TreeExplainer(classifier)
shap_values = explainer.shap_values(X_transformed)

# Gérer les différents formats de sortie de SHAP
if isinstance(shap_values, list):
    values = shap_values[1][0]
else:
    values = shap_values.values if hasattr(shap_values, "values") else shap_values

    if values.ndim == 3:
        # Format : échantillon, variable, classe
        values = values[0, :, 1]
    elif values.ndim == 2:
        # Format : échantillon, variable
        values = values[0]

# 5. Construire le classement des facteurs
explanation = pd.DataFrame({
    "feature": feature_names,
    "shap_value": values,
})

explanation["impact_absolu"] = explanation["shap_value"].abs()
explanation = explanation.sort_values(
    "impact_absolu",
    ascending=False,
)

# 6. Traduire les noms techniques en français
def explain_feature(feature):
    explanations = {
        "numeric__ip_risk_score":
            "Score de risque IP élevé",
        "numeric__failed_attempts":
            "Tentatives de connexion échouées",
        "numeric__hour":
            "Heure de connexion",
        "numeric__impossible_travel":
            "Signal de voyage impossible",
        "numeric__new_device":
            "Nouvel appareil",
    }

    if feature.startswith("categorical__country_"):
        country = feature.replace("categorical__country_", "")
        return f"Pays encodé : {country}"

    return explanations.get(feature, feature)

explanation["facteur"] = explanation["feature"].apply(
    explain_feature
)

# 7. Prédire la classe et la probabilité
prediction = int(model.predict(X_event)[0])
probabilities = model.predict_proba(X_event)[0]
class_index = list(model.classes_).index(prediction)
probability = float(probabilities[class_index]) * 100

print("\n===== IDENTITYSHIELD AI =====")
print("Résultat :", "SUSPECT" if prediction == 1 else "NORMAL")
print(f"Probabilité estimée : {probability:.2f} %")

print("\n===== PRINCIPAUX FACTEURS EXPLICATIFS =====")

for _, row in explanation.head(8).iterrows():
    contribution = row["shap_value"]

    if contribution > 0:
        direction = "renforce la prédiction SUSPECT"
    elif contribution < 0:
        direction = "éloigne de la prédiction SUSPECT"
    else:
        direction = "impact nul ou négligeable"

    print(
        f"- {row['facteur']} : "
        f"SHAP = {contribution:+.5f} ; "
        f"{direction}"
    )

print(
    "\nAttention : les données et les signaux de ce projet "
    "sont simulés. La probabilité du modèle n'est pas une "
    "certitude d'attaque réelle."
)
