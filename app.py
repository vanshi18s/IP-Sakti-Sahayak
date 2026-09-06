"""
Hugging Face Spaces entrypoint (Gradio SDK, free tier).

Gradio SDK just runs this file. We build the vector DB if missing, mount a tiny
Gradio status page at /ui, and serve the real FastAPI app from backend/main.py
on port 7860. All API routes (/chat, /review, /auth/...) work exactly as locally.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
sys.path.insert(0, str(BACKEND))
os.chdir(BACKEND)

# --- build vector DB on first boot (Spaces disk is ephemeral) ---
chroma = ROOT / "data" / "chroma_db"
if not chroma.exists() or not any(chroma.iterdir()):
    print("No vector DB found - ingesting PDFs from data/raw ...", flush=True)
    subprocess.run([sys.executable, "ingest.py"], check=False)

# --- import the real API ---
from main import app  # noqa: E402
from rag import _collection  # noqa: E402

import gradio as gr  # noqa: E402
import uvicorn  # noqa: E402


def status():
    return f"IP-SAKTI Sahayak API is running. Corpus: {_collection().count()} passages. See /docs for endpoints."


demo = gr.Interface(fn=status, inputs=None, outputs="text", title="IP-SAKTI Sahayak API",
                    description="Backend for the SIH26045 assistant. The frontend lives on Vercel.")
app = gr.mount_gradio_app(app, demo, path="/ui")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 7860)))
