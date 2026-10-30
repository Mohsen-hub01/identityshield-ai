"""Initialize the playbook vector index once, then start the API."""

import os
import sys

import chromadb

from rag.config import CHROMA_PATH, COLLECTION_NAME


def ensure_playbook_index() -> None:
    client = chromadb.PersistentClient(path=str(CHROMA_PATH))
    collections = client.list_collections()
    collection_names = {
        item if isinstance(item, str) else item.name
        for item in collections
    }

    if (
        COLLECTION_NAME not in collection_names
        or client.get_collection(name=COLLECTION_NAME).count() == 0
    ):
        print("Building the security playbook vector index.", flush=True)
        from rag.ingest import ingest_playbooks

        ingest_playbooks()


if __name__ == "__main__":
    ensure_playbook_index()
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "main:app",
            "--host",
            "0.0.0.0",
            "--port",
            "8000",
        ],
    )
