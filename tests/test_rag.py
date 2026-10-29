from rag.chunking import split_markdown_document
import numpy as np

import rag.generator as generator

def test_markdown_is_split_by_section():
    document = """# Login Security

## Repeated attempts

Investigate repeated failed logins.

## New device

Review the device and related signals.
"""

    chunks = split_markdown_document(
        document,
        source="knowledge/security_playbooks/test.md",
    )

    assert len(chunks) == 2
    assert chunks[0]["metadata"]["title"] == "Login Security"
    assert chunks[0]["metadata"]["section"] == "Repeated attempts"
    assert chunks[1]["metadata"]["section"] == "New device"


def test_chunks_keep_their_source():
    chunks = split_markdown_document(
        "# Example\n\n## Investigation\n\nReview the event.",
        source="knowledge/security_playbooks/example.md",
    )

    assert len(chunks) == 1
    assert (
        chunks[0]["metadata"]["source"]
        == "knowledge/security_playbooks/example.md"
    )
    assert "Review the event." in chunks[0]["text"]


def test_empty_document_returns_no_chunks():
    assert split_markdown_document(
        "   ",
        source="empty.md",
    ) == []


def test_long_paragraph_is_split():
    text = " ".join(["investigation"] * 100)

    chunks = split_markdown_document(
        f"# Test\n\n## Procedure\n\n{text}",
        source="long.md",
        max_chars=150,
        overlap_chars=20,
    )

    assert len(chunks) > 1

    for chunk in chunks:
        assert "investigation" in chunk["text"]

def test_retriever_returns_source_and_ranked_results(monkeypatch):
    import rag.retriever as retriever

    class FakeEmbeddingModel:
        def encode(self, query, **kwargs):
            assert query == "Investigate suspicious travel"
            return np.array([0.1, 0.2, 0.3])

    class FakeCollection:
        def count(self):
            return 2

        def query(self, **kwargs):
            assert kwargs["n_results"] == 2
            return {
                "ids": [["chunk-1", "chunk-2"]],
                "documents": [["First passage", "Second passage"]],
                "metadatas": [[
                    {
                        "source": "knowledge/security_playbooks/impossible_travel.md",
                        "title": "Impossible Travel Investigation",
                        "section": "Investigation procedure",
                    },
                    {
                        "source": "knowledge/security_playbooks/new_device_access.md",
                        "title": "New Device Access Investigation",
                        "section": "Relevant signals",
                    },
                ]],
                "distances": [[0.15, 0.35]],
            }

    monkeypatch.setattr(
        retriever,
        "_get_embedding_model",
        lambda: FakeEmbeddingModel(),
    )
    monkeypatch.setattr(
        retriever,
        "_get_collection",
        lambda: FakeCollection(),
    )

    results = retriever.retrieve_chunks(
        "Investigate suspicious travel",
        top_k=3,
    )

    assert len(results) == 2
    assert results[0]["id"] == "chunk-1"
    assert results[0]["distance"] < results[1]["distance"]
    assert results[0]["source"].endswith("impossible_travel.md")
    assert results[0]["section"] == "Investigation procedure"


def test_retriever_rejects_empty_query():
    import pytest
    from rag.retriever import retrieve_chunks

    with pytest.raises(ValueError):
        retrieve_chunks("   ")


def test_retriever_rejects_invalid_top_k():
    import pytest
    from rag.retriever import retrieve_chunks

    with pytest.raises(ValueError):
        retrieve_chunks("Suspicious login", top_k=0)


# ============================================================
# RAG answer generation tests
# ============================================================

def test_generator_returns_answer_and_source_metadata(monkeypatch):
    import rag.generator as generator

    monkeypatch.setattr(
        generator,
        "retrieve_chunks",
        lambda query, top_k: [
            {
                "id": "chunk-1",
                "text": "Check repeated failures and successful logins.",
                "source": (
                    "knowledge/security_playbooks/"
                    "repeated_failed_logins.md"
                ),
                "title": "Repeated Failed Login Investigation",
                "section": "Investigation procedure",
                "distance": 0.2,
            }
        ],
    )

    class FakeMessage:
        content = (
            "Review the failed attempts and check for a subsequent "
            "successful login. [S1]"
        )

    class FakeChoice:
        message = FakeMessage()

    class FakeResponse:
        choices = [FakeChoice()]

    class FakeCompletions:
        def create(self, **kwargs):
            self.arguments = kwargs
            return FakeResponse()

    class FakeChat:
        def __init__(self):
            self.completions = FakeCompletions()

    class FakeClient:
        def __init__(self):
            self.chat = FakeChat()

    fake_client = FakeClient()

    result = generator.answer_question(
        "How do we investigate repeated failed logins?",
        client=fake_client,
    )

    assert "[S1]" in result["answer"]
    assert len(result["sources"]) == 1
    assert (
        result["sources"][0]["source"]
        == "knowledge/security_playbooks/"
        "repeated_failed_logins.md"
    )
    assert result["sources"][0]["section"] == "Investigation procedure"
    assert "Retrieved reference passages" in (
        fake_client.chat.completions.arguments["messages"][1]["content"]
    )



def test_generator_returns_fallback_when_no_passages_are_found(
    monkeypatch,
):
    import rag.generator as generator

    monkeypatch.setattr(
        generator,
        "retrieve_chunks",
        lambda query, top_k: [],
    )

    result = generator.answer_question(
        "Question with no matching documents"
    )

    assert result["sources"] == []
    assert result["model"] is None
    assert "Aucun passage" in result["answer"]


def test_generator_rejects_empty_question():
    import pytest
    from rag.generator import answer_question

    with pytest.raises(ValueError):
        answer_question("   ")


def test_generator_requires_api_key_for_real_generation(
    monkeypatch,
):
    import pytest
    import rag.generator as generator

    monkeypatch.setattr(
        generator,
        "retrieve_chunks",
        lambda query, top_k: [
            {
                "id": "chunk-1",
                "text": "A security playbook passage.",
                "source": "knowledge/security_playbooks/example.md",
                "title": "Example",
                "section": "Procedure",
                "distance": 0.1,
            }
        ],
    )

    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)

    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        generator.answer_question("Explain the security procedure")
