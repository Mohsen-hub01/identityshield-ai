import chromadb
from sentence_transformers import SentenceTransformer

from rag.chunking import split_markdown_document
from rag.config import (
    BASE_DIR,
    CHROMA_PATH,
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    COLLECTION_NAME,
    EMBEDDING_MODEL_NAME,
    PLAYBOOKS_DIR,
)


def load_playbook_chunks() -> list[dict]:
    """Load all Markdown playbooks and split them into chunks."""
    if not PLAYBOOKS_DIR.is_dir():
        raise FileNotFoundError(
            f"Dossier de playbooks introuvable : {PLAYBOOKS_DIR}"
        )

    chunks = []

    for path in sorted(PLAYBOOKS_DIR.glob("*.md")):
        content = path.read_text(encoding="utf-8-sig")

        source = path.relative_to(BASE_DIR).as_posix()

        document_chunks = split_markdown_document(
            markdown=content,
            source=source,
            max_chars=CHUNK_SIZE,
            overlap_chars=CHUNK_OVERLAP,
        )

        chunks.extend(document_chunks)

    if not chunks:
        raise ValueError(
            f"Aucun passage trouvé dans {PLAYBOOKS_DIR}"
        )

    return chunks


def ingest_playbooks() -> int:
    """Embed playbook chunks and rebuild the local Chroma collection."""
    chunks = load_playbook_chunks()

    print(f"Passages chargés : {len(chunks)}")
    print(f"Modèle d'embeddings : {EMBEDDING_MODEL_NAME}")

    # Load the embedding model and vectorize all chunks.
    # Its model files may be downloaded during the first run.
    embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    texts = [chunk["text"] for chunk in chunks]

    embeddings = embedding_model.encode(
        texts,
        batch_size=16,
        show_progress_bar=True,
        convert_to_numpy=True,
        normalize_embeddings=True,
    )

    CHROMA_PATH.parent.mkdir(parents=True, exist_ok=True)

    client = chromadb.PersistentClient(
        path=str(CHROMA_PATH)
    )

    # Rebuild this generated collection so removed or changed source
    # chunks do not leave stale records behind.
    existing_names = [
        item if isinstance(item, str) else item.name
        for item in client.list_collections()
    ]

    if COLLECTION_NAME in existing_names:
        client.delete_collection(name=COLLECTION_NAME)

    collection = client.create_collection(
        name=COLLECTION_NAME,
        configuration={"hnsw": {"space": "cosine"}},
    )

    collection.add(
        ids=[chunk["id"] for chunk in chunks],
        documents=texts,
        metadatas=[chunk["metadata"] for chunk in chunks],
        embeddings=embeddings.tolist(),
    )

    print("Indexation terminée.")
    print(f"Collection : {COLLECTION_NAME}")
    print(f"Passages indexés : {collection.count()}")
    print(f"Base locale : {CHROMA_PATH}")

    return collection.count()


if __name__ == "__main__":
    ingest_playbooks()
