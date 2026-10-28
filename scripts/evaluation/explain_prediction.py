
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[2]

import joblib
import pandas as pd

# 1. Charger le modèle déjà entraîné
model = joblib.load(BASE_DIR / "models" / "randomforest.joblib")


def explain_prediction(event: dict) -> dict:
    """
    Prédit si une connexion est suspecte et explique
    les principaux signaux observés.
    """

    # 2. Convertir l'événement au format attendu par le modèle
    data = pd.DataFrame([event])

    # 3. Obtenir la classe prédite et les probabilités
    prediction = int(model.predict(data)[0])
    probabilities = model.predict_proba(data)[0]

    # Trouver la probabilité associée à la classe prédite
    classes = list(model.classes_)
    predicted_index = classes.index(prediction)
    probability = float(probabilities[predicted_index])

    # 4. Construire une explication lisible à partir des signaux
    factors = []

    if event["country"] != "France":
        factors.append({
            "factor": "Pays différent de la France",
            "observed_value": event["country"],
            "description": (
                "La connexion provient d'un pays différent "
                "du pays de référence utilisé dans cette démonstration."
            ),
        })

    if event["hour"] < 7 or event["hour"] >= 22:
        factors.append({
            "factor": "Horaire inhabituel",
            "observed_value": event["hour"],
            "description": (
                "La connexion a lieu en dehors de la plage "
                "horaire habituelle définie pour cette démonstration."
            ),
        })

    if event["failed_attempts"] >= 3:
        factors.append({
            "factor": "Tentatives échouées répétées",
            "observed_value": event["failed_attempts"],
            "description": (
                "Plusieurs tentatives de connexion ont échoué."
            ),
        })

    if event["new_device"] == 1:
        factors.append({
            "factor": "Nouvel appareil",
            "observed_value": True,
            "description": (
                "L'événement est associé à un appareil signalé "
                "comme nouveau."
            ),
        })

    if event["ip_risk_score"] >= 60:
        factors.append({
            "factor": "Score IP élevé",
            "observed_value": event["ip_risk_score"],
            "description": (
                "Le score de risque IP simulé est élevé."
            ),
        })

    if event["impossible_travel"] == 1:
        factors.append({
            "factor": "Voyage impossible signalé",
            "observed_value": True,
            "description": (
                "Le jeu de données signale un déplacement "
                "géographique suspect."
            ),
        })

    return {
        "prediction": "Suspect" if prediction == 1 else "Normal",
        "probability": round(probability, 4),
        "probability_percent": round(probability * 100, 2),
        "explanation": factors,
        "note": (
            "Les facteurs listés sont des signaux observés. "
            "Ils ne représentent pas nécessairement les causes "
            "exactes de la prédiction du modèle."
        ),
    }


if __name__ == "__main__":
    sample_event = {
        "country": "Maroc",
        "hour": 2,
        "failed_attempts": 5,
        "new_device": 1,
        "ip_risk_score": 85,
        "impossible_travel": 1,
    }

    result = explain_prediction(sample_event)

    print("\n=== Résultat IdentityShield AI ===")
    print(f"Prédiction : {result['prediction']}")
    print(f"Probabilité estimée : {result['probability_percent']} %")
    print("\nSignaux observés :")

    for factor in result["explanation"]:
        print(f"- {factor['factor']} : {factor['description']}")

    print(f"\nNote : {result['note']}")
