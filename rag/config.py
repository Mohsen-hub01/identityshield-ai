import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]

PLAYBOOKS_DIR = BASE_DIR / "knowledge" / "security_playbooks"

CHROMA_PATH = BASE_DIR / "storage" / "chroma_db"

COLLECTION_NAME = "identityshield_security_playbooks"

EMBEDDING_MODEL_NAME = os.getenv(
    "IDENTITYSHIELD_EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)

CHUNK_SIZE = 1000
CHUNK_OVERLAP = 120

DEFAULT_TOP_K = 3
