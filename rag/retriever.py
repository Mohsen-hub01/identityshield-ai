from functools import lru_cache

import chromadb
from sentence_transformers import SentenceTransformer

from rag.config import (
    CHROMA_PATH,
    COLLECTION_NAME,
    DEFAULT_TOP_K,
    EMBEDDING_MODEL_NAME,
)


@lru_cache(maxsize=1)
def _get_embedding_model() -> SentenceTransformer:
    """Load the embedding model once per Python process."""
    return SentenceTransformer(EMBEDDING_MODEL_NAME)


@lru_cache(maxsize=1)
def _get_collection():
    """Open the persistent ChromaDB collection."""
    client = chromadb.PersistentClient(
        path=str(CHROMA_PATH)
    )
    return client.get_collection(name=COLLECTION_NAME)


def retrieve_chunks(
    query: str,
    top_k: int = DEFAULT_TOP_K,
) -> list[dict]:
    """Retrieve semantically relevant security-playbook passages.

    Results are ordered by ChromaDB distance, from closest to farthest.
    Lower cosine distance means a closer vector match.
    """
    if not isinstance(query, str) or not query.strip():
        raise ValueError("La question ne doit pas être vide.")

    if isinstance(top_k, bool) or not isinstance(top_k, int) or top_k < 1:
        raise ValueError("top_k doit être un entier strictement positif.")

    collection = _get_collection()
    collection_size = collection.count()

    if collection_size == 0:
        return []

    embedding_model = _get_embedding_model()

    query_embedding = embedding_model.encode(
    query.strip(),
    convert_to_numpy=True,
    normalize_embeddings=True,
)

    result = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=min(top_k, collection_size),
        include=["documents", "metadatas", "distances"],
    )

    ids = result["ids"][0]
    documents = result["documents"][0]
    metadatas = result["metadatas"][0]
    distances = result["distances"][0]

    matches = []

    for chunk_id, text, metadata, distance in zip(
        ids,
        documents,
        metadatas,
        distances,
    ):
        matches.append({
            "id": chunk_id,
            "text": text,
            "source": metadata.get("source", "unknown"),
            "title": metadata.get("title", "Untitled"),
            "section": metadata.get("section", "Unknown"),
            "distance": round(float(distance), 6),
        })

    return matches
