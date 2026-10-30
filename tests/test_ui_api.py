import os

os.environ.setdefault(
    "IDENTITYSHIELD_SECRET_KEY",
    "identityshield-test-only-secret-key",
)

from fastapi.testclient import TestClient

from auth_security import create_access_token
from main import app


def authenticated_client(role: str, username: str | None = None) -> TestClient:
    token = create_access_token(
        data={"sub": username or f"{role}1", "role": role},
    )
    return TestClient(app, headers={"Authorization": f"Bearer {token}"})


analyst = authenticated_client("analyst")
admin = authenticated_client("admin")
viewer = authenticated_client("viewer")
anonymous = TestClient(app)


def test_ui_endpoints_require_authentication():
    for path in (
        "/api/ui/overview",
        "/api/ui/identities",
        "/api/ui/events",
        "/api/ui/threat-graph",
        "/api/ui/analytics",
        "/api/ui/playbooks",
        "/api/ui/review-audit",
    ):
        assert anonymous.get(path).status_code == 401


def test_overview_returns_dataset_counts():
    response = analyst.get("/api/ui/overview")

    assert response.status_code == 200
    payload = response.json()
    assert payload["dataset"]["synthetic"] is True
    assert payload["counts"]["identities"] > 0
    assert payload["counts"]["events"] > 0
    assert payload["model"]["name"]
    assert isinstance(payload["insights"], list) and payload["insights"]


def test_identities_and_identity_detail():
    listing = analyst.get("/api/ui/identities")
    assert listing.status_code == 200
    identities = listing.json()["identities"]
    assert listing.json()["count"] == len(identities) > 0

    user_id = identities[0]["user_id"]
    detail = analyst.get(f"/api/ui/identities/{user_id}")
    assert detail.status_code == 200
    payload = detail.json()
    assert payload["identity"]["user_id"] == user_id
    assert isinstance(payload["recent_events"], list)


def test_unknown_identity_returns_404():
    response = analyst.get("/api/ui/identities/utilisateur_inconnu")

    assert response.status_code == 404


def test_events_are_paginated_and_filterable():
    response = analyst.get("/api/ui/events", params={"limit": 5, "risk_level": "HIGH"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["limit"] == 5
    assert len(payload["events"]) <= 5
    assert all(event["risk_level"] == "HIGH" for event in payload["events"])


def test_threat_graph_links_reference_known_nodes():
    response = analyst.get("/api/ui/threat-graph")

    assert response.status_code == 200
    payload = response.json()
    node_ids = {node["id"] for node in payload["nodes"]}
    assert node_ids
    for link in payload["links"]:
        assert link["source"] in node_ids
        assert link["target"] in node_ids


def test_analytics_includes_model_evidence():
    response = analyst.get("/api/ui/analytics")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["risk_distribution"]) == 3
    assert len(payload["hourly_activity"]) == 24
    assert payload["model"]["final_metrics"]["model"]
    assert payload["model"]["selected"]["selected_model"]


def test_playbooks_and_semantic_search():
    response = analyst.get("/api/ui/playbooks")
    assert response.status_code == 200
    assert response.json()["count"] > 0

    search = analyst.post(
        "/api/ui/playbooks/search",
        json={"query": "impossible travel response", "top_k": 2},
    )
    assert search.status_code == 200
    payload = search.json()
    assert payload["mode"] in {"semantic", "keyword-fallback"}
    assert len(payload["matches"]) <= 2


def test_review_audit_is_restricted_to_admin_and_analyst():
    assert viewer.get("/api/ui/review-audit").status_code == 403
    assert admin.get("/api/ui/review-audit").status_code == 200
    assert analyst.get("/api/ui/review-audit").status_code == 200
