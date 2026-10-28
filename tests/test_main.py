import os
from datetime import timedelta


# Clé de test locale, uniquement si aucune clé n'est déjà configurée.
os.environ.setdefault(
    "IDENTITYSHIELD_SECRET_KEY",
    "identityshield-test-only-secret-key",
)

from fastapi.testclient import TestClient

from auth_security import create_access_token
from main import app


# Créer un token JWT de test pour le rôle analyst.
test_token = create_access_token(
    data={
        "sub": "analyst1",
        "role": "analyst",
    }
)

# Les tests ordinaires sont authentifiés par défaut.
client = TestClient(
    app,
    headers={
        "Authorization": f"Bearer {test_token}",
    },
)

# Client distinct pour tester les accès sans authentification.
unauthenticated_client = TestClient(app)

# Profil existant dans data/user_profiles.csv :
# user_002 -> France, heure habituelle 10 h.
USER_ID = "user_002"


def send_event(**overrides):
    payload = {
        "user_id": USER_ID,
        "country": "France",
        "hour": 10,
        "failed_attempts": 0,
    }
    payload.update(overrides)
    return client.post("/analyze", json=payload)


def test_analyze_requires_authentication():
    response = unauthenticated_client.post(
        "/analyze",
        json={
            "user_id": USER_ID,
            "country": "France",
            "hour": 10,
            "failed_attempts": 0,
        },
    )

    assert response.status_code == 401


def test_normal_access():
    response = send_event()

    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] == 0
    assert data["risk_level"] == "LOW"


def test_suspicious_access():
    response = send_event(country="Maroc", hour=3)

    assert response.status_code == 200
    data = response.json()
    assert data["risk_score"] == 70
    assert data["risk_level"] == "HIGH"


def test_unknown_user():
    response = send_event(user_id="utilisateur_inconnu")

    assert response.status_code == 404


def test_hour_at_start_is_normal():
    response = send_event(hour=8)

    assert response.status_code == 200
    assert response.json()["risk_score"] == 0
    assert response.json()["risk_level"] == "LOW"


def test_hour_at_end_is_unusual():
    response = send_event(hour=18)

    assert response.status_code == 200
    assert response.json()["risk_score"] == 20
    assert response.json()["risk_level"] == "LOW"


def test_failed_attempts_add_risk():
    response = send_event(failed_attempts=3)

    assert response.status_code == 200
    assert response.json()["risk_score"] == 30
    assert response.json()["risk_level"] == "MEDIUM"


def test_risk_score_capped_at_100():
    response = send_event(
        country="Maroc",
        hour=3,
        failed_attempts=100,
    )

    assert response.status_code == 200
    assert response.json()["risk_score"] == 100
    assert response.json()["risk_level"] == "HIGH"


def test_invalid_hour_rejected():
    response = send_event(hour=24)

    assert response.status_code == 422


def test_invalid_failed_attempts_rejected():
    response = send_event(failed_attempts=-1)

    assert response.status_code == 422


def test_ml_analysis_fields_present():
    response = send_event(
        new_device=0,
        ip_risk_score=10,
        impossible_travel=0,
    )

    assert response.status_code == 200
    data = response.json()
    ml = data["ml_analysis"]

    assert ml["prediction"] in ["NORMAL", "SUSPECT"]
    assert 0 <= ml["suspect_probability"] <= 1
    assert 0 < ml["decision_threshold"] < 1


def test_ml_decision_respects_threshold():
    response = send_event(
        country="Maroc",
        hour=3,
        failed_attempts=5,
        new_device=1,
        ip_risk_score=82,
        impossible_travel=1,
    )

    assert response.status_code == 200
    ml = response.json()["ml_analysis"]

    expected = (
        "SUSPECT"
        if ml["suspect_probability"] >= ml["decision_threshold"]
        else "NORMAL"
    )
    assert ml["prediction"] == expected


def test_shap_explanations_present():
    response = send_event(
        failed_attempts=1,
        new_device=1,
        ip_risk_score=60,
        impossible_travel=0,
    )

    assert response.status_code == 200
    explanations = response.json()["ml_analysis"]["explanations"]

    assert isinstance(explanations, list)
    assert len(explanations) > 0

    for item in explanations:
        assert "factor" in item
        assert "shap_value" in item
        assert item["direction"] in [
            "increases_suspicion",
            "decreases_suspicion",
            "neutral",
        ]


def test_disclaimer_present():
    response = send_event()

    assert response.status_code == 200
    disclaimer = response.json()["disclaimer"].casefold()

    # Vérification indépendante des accents et de leur encodage.
    import unicodedata

    normalized = unicodedata.normalize("NFKD", disclaimer)
    normalized = "".join(
        char for char in normalized
        if not unicodedata.combining(char)
    )

    assert "synthetiques" in normalized
    assert "attaque reelle" in normalized


def test_high_risk_recommends_human_review():
    response = send_event(
        user_id="user_001",
        country="Maroc",
        hour=1,
        failed_attempts=5,
    )

    assert response.status_code == 200
    assert response.json()["risk_level"] == "HIGH"
    assert (
        response.json()["recommended_action"]
        == "HUMAN_REVIEW_REQUIRED"
    )


def test_low_risk_does_not_escalate():
    response = send_event(
        user_id="user_002",
        country="France",
        hour=10,
        failed_attempts=0,
    )

    assert response.status_code == 200
    assert response.json()["risk_level"] == "LOW"
    assert (
        response.json()["recommended_action"]
        == "NO_ESCALATION"
    )


def test_human_review_can_resume_workflow():
    response = send_event(
        user_id="user_001",
        country="Maroc",
        hour=1,
        failed_attempts=5,
    )

    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "awaiting_human_review"

    review_response = client.post(
        "/review",
        json={
            "analysis_id": data["analysis_id"],
            "decision": "confirm_suspicious",
        },
    )

    assert review_response.status_code == 200

    result = review_response.json()
    assert result["status"] == "review_completed"
    assert result["review_decision"] == "confirm_suspicious"
    assert (
        result["recommended_action"]
        == "ESCALATE_AS_SUSPICIOUS"
    )


def test_human_review_is_written_to_audit_log(monkeypatch, tmp_path):
    import json
    import main

    audit_file = tmp_path / "human_review_audit.jsonl"
    monkeypatch.setattr(main, "AUDIT_PATH", audit_file)

    response = send_event(
        user_id="user_001",
        country="Maroc",
        hour=1,
        failed_attempts=5,
    )

    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "awaiting_human_review"

    review_response = client.post(
        "/review",
        json={
            "analysis_id": data["analysis_id"],
            "decision": "confirm_suspicious",
        },
    )

    assert review_response.status_code == 200
    assert audit_file.exists()

    record = json.loads(audit_file.read_text(encoding="utf-8").splitlines()[0])
    assert record["analysis_id"] == data["analysis_id"]
    assert record["user_id"] == "user_001"
    assert record["risk_level"] == "HIGH"
    assert record["review_decision"] == "confirm_suspicious"
    assert record["recommended_action"] == "ESCALATE_AS_SUSPICIOUS"
    assert record["reviewer_identity"] is None



# ============================================================
# RBAC and JWT security tests
# ============================================================

def make_client_for_role(role: str) -> TestClient:
    """Create a test client with a signed JWT for a given role."""
    token = create_access_token(
        data={
            "sub": f"test_{role}",
            "role": role,
        }
    )

    return TestClient(
        app,
        headers={"Authorization": f"Bearer {token}"},
    )


def test_profiles_requires_authentication():
    response = unauthenticated_client.get("/profiles")

    assert response.status_code == 401


def test_invalid_token_is_rejected():
    invalid_client = TestClient(
        app,
        headers={"Authorization": "Bearer invalid-token"},
    )

    response = invalid_client.get("/profiles")

    assert response.status_code == 401


def test_expired_token_is_rejected():
    expired_token = create_access_token(
        data={"sub": "test_analyst", "role": "analyst"},
        expires_delta=timedelta(seconds=-1),
    )

    expired_client = TestClient(
        app,
        headers={"Authorization": f"Bearer {expired_token}"},
    )

    response = expired_client.get("/profiles")

    assert response.status_code == 401


def test_all_roles_can_read_profiles():
    for role in ("admin", "analyst", "viewer"):
        role_client = make_client_for_role(role)

        response = role_client.get("/profiles")

        assert response.status_code == 200, (
            f"Le rôle {role} devrait pouvoir consulter les profils."
        )


def test_viewer_cannot_analyze():
    viewer_client = make_client_for_role("viewer")

    response = viewer_client.post(
        "/analyze",
        json={
            "user_id": USER_ID,
            "country": "France",
            "hour": 10,
            "failed_attempts": 0,
        },
    )

    assert response.status_code == 403


def test_viewer_cannot_submit_review():
    viewer_client = make_client_for_role("viewer")

    response = viewer_client.post(
        "/review",
        json={
            "analysis_id": "nonexistent-test-analysis",
            "decision": "confirm_suspicious",
        },
    )

    assert response.status_code == 403


def test_unauthenticated_review_is_rejected():
    response = unauthenticated_client.post(
        "/review",
        json={
            "analysis_id": "nonexistent-test-analysis",
            "decision": "confirm_suspicious",
        },
    )

    assert response.status_code == 401


def test_admin_can_analyze():
    admin_client = make_client_for_role("admin")

    response = admin_client.post(
        "/analyze",
        json={
            "user_id": USER_ID,
            "country": "France",
            "hour": 10,
            "failed_attempts": 0,
        },
    )

    assert response.status_code == 200