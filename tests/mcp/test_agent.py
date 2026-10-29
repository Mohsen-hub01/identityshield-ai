import asyncio
import json
from types import SimpleNamespace

from identityshield_mcp import agent


class FakeToolCall:
    def __init__(self, name, arguments, call_id="call-1"):
        self.id = call_id
        self.function = SimpleNamespace(
            name=name,
            arguments=json.dumps(arguments),
        )


class FakeMessage:
    def __init__(self, content=None, tool_calls=None):
        self.content = content
        self.tool_calls = tool_calls or []

    def model_dump(self, exclude_none=True):
        data = {"role": "assistant"}
        if self.content is not None:
            data["content"] = self.content
        if self.tool_calls:
            data["tool_calls"] = [
                {
                    "id": call.id,
                    "type": "function",
                    "function": {
                        "name": call.function.name,
                        "arguments": call.function.arguments,
                    },
                }
                for call in self.tool_calls
            ]
        return data


class FakeCompletions:
    def __init__(self, responses):
        self.responses = list(responses)
        self.requests = []

    async def create(self, **kwargs):
        self.requests.append(kwargs)
        return SimpleNamespace(
            choices=[
                SimpleNamespace(message=self.responses.pop(0))
            ]
        )


class FakeMCPClient:
    def __init__(self, results=None):
        names = [
            "search_security_playbook",
            "get_user_profile",
            "analyze_access_event",
            "submit_human_review_decision",
        ]

        self.tools = [
            SimpleNamespace(
                name=name,
                description=name,
                input_schema={
                    "type": "object",
                    "properties": {},
                },
            )
            for name in names
        ]
        self.results = results or {}
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def list_tools(self):
        return SimpleNamespace(tools=self.tools)

    async def call_tool(self, name, arguments):
        self.calls.append((name, arguments))
        return self.results[name]


def fake_tool_result(payload):
    return SimpleNamespace(
        is_error=False,
        structured_content=payload,
        content=[],
    )


def fake_llm(responses):
    completions = FakeCompletions(responses)
    client = SimpleNamespace(
        chat=SimpleNamespace(completions=completions)
    )
    return client, completions


def test_agent_excludes_human_review_tool():
    assert agent.ALLOWED_TOOLS == {
        "search_security_playbook",
        "get_user_profile",
        "analyze_access_event",
    }
    assert "submit_human_review_decision" not in agent.ALLOWED_TOOLS


def test_result_to_json_preserves_structured_data():
    result = fake_tool_result({
        "risk_score": 100,
        "risk_level": "HIGH",
    })

    payload = json.loads(agent.result_to_json(result))

    assert payload["risk_score"] == 100
    assert payload["risk_level"] == "HIGH"


def test_result_to_json_preserves_tool_errors():
    result = SimpleNamespace(
        is_error=True,
        structured_content=None,
        content=[SimpleNamespace(text="Invalid arguments")],
    )

    payload = json.loads(agent.result_to_json(result))

    assert payload["error"] is True
    assert "Invalid arguments" in payload["details"]


def test_agent_calls_allowed_tool_and_uses_its_result(
    monkeypatch, capsys
):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mcp_client = FakeMCPClient(
        results={
            "analyze_access_event": fake_tool_result({
                "user_id": "user_001",
                "risk_score": 100,
                "risk_level": "HIGH",
            })
        }
    )

    llm, completions = fake_llm([
        FakeMessage(tool_calls=[
            FakeToolCall(
                "analyze_access_event",
                {
                    "user_id": "user_001",
                    "country": "France",
                    "hour": 14,
                    "impossible_travel": 1,
                },
            )
        ]),
        FakeMessage(content="Rapport fondé sur le résultat MCP."),
    ])

    monkeypatch.setattr(
        agent,
        "Client",
        lambda server: mcp_client,
    )
    monkeypatch.setattr(
        agent,
        "AsyncOpenAI",
        lambda **kwargs: llm,
    )

    asyncio.run(agent.run_agent("Analyse user_001"))

    assert len(mcp_client.calls) == 1
    assert mcp_client.calls[0][0] == "analyze_access_event"

    advertised_tools = {
        item["function"]["name"]
        for item in completions.requests[0]["tools"]
    }
    assert "submit_human_review_decision" not in advertised_tools

    tool_message = next(
        message
        for message in completions.requests[1]["messages"]
        if message["role"] == "tool"
    )
    tool_payload = json.loads(tool_message["content"])

    assert tool_payload["risk_score"] == 100
    assert tool_payload["risk_level"] == "HIGH"
    assert "Rapport fondé sur le résultat MCP." in capsys.readouterr().out


def test_agent_does_not_execute_human_review_tool(
    monkeypatch, capsys
):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")

    mcp_client = FakeMCPClient()

    llm, completions = fake_llm([
        FakeMessage(tool_calls=[
            FakeToolCall(
                "submit_human_review_decision",
                {
                    "analysis_id": "test-analysis",
                    "decision": "confirm_suspicious",
                    "confirm": True,
                },
            )
        ]),
        FakeMessage(content="La décision humaine n'a pas été exécutée."),
    ])

    monkeypatch.setattr(
        agent,
        "Client",
        lambda server: mcp_client,
    )
    monkeypatch.setattr(
        agent,
        "AsyncOpenAI",
        lambda **kwargs: llm,
    )

    asyncio.run(agent.run_agent("Confirme la suspicion"))

    assert mcp_client.calls == []

    tool_message = next(
        message
        for message in completions.requests[1]["messages"]
        if message["role"] == "tool"
    )
    error_payload = json.loads(tool_message["content"])

    assert error_payload["error"] is True
    assert "non autorisé" in error_payload["details"].lower()
    assert "La décision humaine n'a pas été exécutée." in (
        capsys.readouterr().out
    )
