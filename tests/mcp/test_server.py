import sys
import types

import pytest
from fastapi import HTTPException
from mcp import Client
import os

os.environ["IDENTITYSHIELD_ENABLE_MCP_REVIEW_TOOL"] = "true"
from identityshield_mcp.server import mcp


@pytest.fixture
def anyio_backend():
    return "asyncio"


def install_fake_main(monkeypatch, **attributes):
    """Install a lightweight replacement for main.py during a test."""
    module = types.ModuleType("main")

    for name, value in attributes.items():
        setattr(module, name, value)

    monkeypatch.setitem(sys.modules, "main", module)
    return module


@pytest.mark.anyio
async def test_four_tools_are_discoverable_with_expected_parameters():
    async with Client(mcp, raise_exceptions=True) as client:
        response = await client.list_tools()

    tools = {tool.name: tool for tool in response.tools}

    expected = {
        "search_security_playbook",
        "get_user_profile",
        "analyze_access_event",
        "submit_human_review_decision",
    }
    assert expected.issubset(tools)

    search_props = tools["search_security_playbook"].input_schema["properties"]
    assert {"query", "top_k"}.issubset(search_props)

    profile_props = tools["get_user_profile"].input_schema["properties"]
    assert "user_id" in profile_props

    analysis_props = tools["analyze_access_event"].input_schema["properties"]
    assert {"user_id", "country", "hour", "impossible_travel"}.issubset(
        analysis_props
    )

    review_props = tools[
        "submit_human_review_decision"
    ].input_schema["properties"]
    assert {"analysis_id", "decision", "confirm"}.issubset(review_props)
    assert set(review_props["decision"]["enum"]) == {
        "confirm_suspicious",
        "mark_legitimate",
    }


@pytest.mark.anyio
async def test_search_tool_returns_real_rag_results():
    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "search_security_playbook",
            {
                "query": "repeated failed logins",
                "top_k": 3,
            },
        )

    assert not result.is_error
    payload = result.structured_content
    assert payload is not None
    assert payload["result_count"] >= 1
    assert payload["matches"][0]["source"]
    assert payload["matches"][0]["text"]


@pytest.mark.anyio
async def test_search_rejects_blank_query():
    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "search_security_playbook",
            {"query": "   ", "top_k": 3},
        )

    assert result.is_error


@pytest.mark.anyio
async def test_get_user_profile_returns_synthetic_profile(monkeypatch):
    def fake_get_user_profile(user_id):
        assert user_id == "user_001"
        return {"home_country": "Espagne", "usual_hour": 14}

    install_fake_main(
        monkeypatch,
        get_user_profile=fake_get_user_profile,
    )

    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "get_user_profile",
            {"user_id": "user_001"},
        )

    assert not result.is_error
    payload = result.structured_content
    assert payload["found"] is True
    assert payload["profile"]["home_country"] == "Espagne"


@pytest.mark.anyio
async def test_get_user_profile_handles_unknown_user(monkeypatch):
    def fake_get_user_profile(user_id):
        raise HTTPException(status_code=404, detail="Profile not found")

    install_fake_main(
        monkeypatch,
        get_user_profile=fake_get_user_profile,
    )

    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "get_user_profile",
            {"user_id": "user_does_not_exist"},
        )

    assert not result.is_error
    payload = result.structured_content
    assert payload["found"] is False
    assert payload["profile"] is None


@pytest.mark.anyio
async def test_analyze_access_event_returns_structured_analysis(monkeypatch):
    class FakeAccessEvent:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)

    def fake_analyze_access(event):
        return {
            "user_id": event.user_id,
            "risk_score": 0,
            "risk_level": "LOW",
            "reasons": ["No risk indicators"],
            "evaluated_at": "2026-01-01T00:00:00+00:00",
            "ml_analysis": {
                "prediction": "NORMAL",
                "suspect_probability": 0.1,
                "decision_threshold": 0.6,
                "explanations": [],
            },
            "recommended_action": "NO_ESCALATION",
            "disclaimer": "Synthetic test data.",
        }

    install_fake_main(
        monkeypatch,
        AccessEvent=FakeAccessEvent,
        analyze_access=fake_analyze_access,
    )

    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "analyze_access_event",
            {
                "user_id": "user_001",
                "country": "Espagne",
                "hour": 14,
                "failed_attempts": 0,
                "new_device": 0,
                "ip_risk_score": 10,
                "impossible_travel": 0,
            },
        )

    assert not result.is_error
    payload = result.structured_content

    if "result" in payload:
        payload = payload["result"]

    assert payload["risk_level"] == "LOW"
    assert payload["recommended_action"] == "NO_ESCALATION"
    assert payload["ml_analysis"]["prediction"] == "NORMAL"


@pytest.mark.anyio
async def test_analyze_access_event_rejects_invalid_hour():
    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "analyze_access_event",
            {
                "user_id": "user_001",
                "country": "Espagne",
                "hour": 25,
            },
        )

    assert result.is_error


@pytest.mark.anyio
async def test_review_requires_explicit_confirmation():
    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "submit_human_review_decision",
            {
                "analysis_id": "test-analysis-id",
                "decision": "confirm_suspicious",
                "confirm": False,
            },
        )

    assert result.is_error


@pytest.mark.anyio
async def test_review_resumes_workflow_and_returns_result(monkeypatch):
    class FakeReviewDecisionRequest:
        def __init__(self, analysis_id, decision):
            self.analysis_id = analysis_id
            self.decision = decision

    def fake_submit_review(request):
        assert request.analysis_id == "test-analysis-id"
        assert request.decision == "confirm_suspicious"

        return {
            "status": "review_completed",
            "user_id": "user_001",
            "risk_score": 100,
            "risk_level": "HIGH",
            "ml_analysis": {"prediction": "SUSPECT"},
            "review_decision": "confirm_suspicious",
            "recommended_action": "ESCALATE_AS_SUSPICIOUS",
            "disclaimer": "Synthetic test data.",
        }

    install_fake_main(
        monkeypatch,
        ReviewDecisionRequest=FakeReviewDecisionRequest,
        submit_human_review=fake_submit_review,
    )

    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "submit_human_review_decision",
            {
                "analysis_id": "test-analysis-id",
                "decision": "confirm_suspicious",
                "confirm": True,
            },
        )

    assert not result.is_error
    payload = result.structured_content
    assert payload["status"] == "review_completed"
    assert payload["review_decision"] == "confirm_suspicious"
    assert payload["recommended_action"] == "ESCALATE_AS_SUSPICIOUS"


@pytest.mark.anyio
async def test_review_reports_expired_or_unknown_analysis(monkeypatch):
    class FakeReviewDecisionRequest:
        def __init__(self, analysis_id, decision):
            self.analysis_id = analysis_id
            self.decision = decision

    def fake_submit_review(request):
        raise HTTPException(
            status_code=404,
            detail="Analyse introuvable ou expirée.",
        )

    install_fake_main(
        monkeypatch,
        ReviewDecisionRequest=FakeReviewDecisionRequest,
        submit_human_review=fake_submit_review,
    )

    async with Client(mcp, raise_exceptions=True) as client:
        result = await client.call_tool(
            "submit_human_review_decision",
            {
                "analysis_id": "expired-analysis",
                "decision": "confirm_suspicious",
                "confirm": True,
            },
        )

    assert result.is_error
