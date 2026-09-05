"""Central settings. Reads from .env in the backend folder."""
import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
EMBED_MODEL = os.getenv("EMBED_MODEL", "BAAI/bge-m3")

CHROMA_DIR = (BASE_DIR / os.getenv("CHROMA_DIR", "../data/chroma_db")).resolve()
RAW_DIR = (BASE_DIR / os.getenv("RAW_DIR", "../data/raw")).resolve()

COLLECTION_NAME = "legal_corpus"

# Retrieval settings
TOP_K = 8            # chunks fetched from vector DB
CHUNK_WORDS = 350    # approx words per chunk
CHUNK_OVERLAP = 50   # words of overlap between chunks

# Confidence thresholds (0..1)
ABSTAIN_THRESHOLD = 0.35

DISCLAIMER = (
    "This assistant provides information, not legal advice. "
    "Verify with the cited source or consult a qualified IP professional."
)
