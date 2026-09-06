"""
Hugging Face Spaces entrypoint (Gradio SDK, free tier).

The SDK just runs this file. We build the vector DB if missing, warm up the
retriever so the first request never races the DB init, then serve the FastAPI
app from backend/main.py on port 7860. Gradio itself is not used.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

chroma = ROOT / "data" / "chroma_db"
if not chroma.exists() or not any(chroma.iterdir()):
    print("No vector DB found - ingesting documents ...", flush=True)
    subprocess.run([sys.executable, "ingest.py"], check=False)

from main import app  # noqa: E402
from rag import _collection, _embedder, _bm25  # noqa: E402
import uvicorn  # noqa: E402

# Warm-up: open Chroma, load embedder, build BM25 before accepting traffic.
print("Warming up retriever ...", flush=True)
n = _collection().count()
_embedder()
_bm25()
print(f"Ready. Corpus has {n} chunks.", flush=True)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 7860)))
