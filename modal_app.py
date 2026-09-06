"""
Deploy the backend on Modal (free tier: $30/month credit, no card needed).

One-time:
    pip install modal
    modal setup                       # opens browser, login with GitHub
    modal secret create ipsakti GROQ_API_KEY=xxx JWT_SECRET=yyy GROQ_MODEL=openai/gpt-oss-120b

Deploy / redeploy (also re-ingests when documents change):
    modal deploy modal_app.py

Prints a URL like https://<user>--ip-sakti-sahayak-api.modal.run  -> put in Vercel VITE_API_URL
"""
import modal

APP_NAME = "ip-sakti-sahayak"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install_from_requirements("backend/requirements.txt", extra_index_url="https://download.pytorch.org/whl/cpu")
    .add_local_dir("backend", remote_path="/app/backend")
    .add_local_dir("data", remote_path="/app/data", ignore=["chroma_db/**", "users.db"])
    .add_local_dir("markdown_output", remote_path="/app/markdown_output")
)

app = modal.App(APP_NAME)
store = modal.Volume.from_name("ipsakti-store", create_if_missing=True)   # chroma_db + users.db + model cache


@app.function(
    image=image,
    secrets=[modal.Secret.from_name("ipsakti")],
    volumes={"/store": store},
    memory=8192,
    cpu=2,
    timeout=600,
    scaledown_window=900,          # stay warm 15 min after last request
    min_containers=0,
)
@modal.asgi_app(label="api")
def api():
    import os, sys, subprocess, shutil
    from pathlib import Path

    os.environ.setdefault("HF_HOME", "/store/hf_cache")
    os.environ["CHROMA_DIR"] = "/store/chroma_db"
    os.environ["RAW_DIR"] = "/app/data/raw"
    sys.path.insert(0, "/app/backend")
    os.chdir("/app/backend")

    # users.db must live on the volume so accounts persist
    Path("/store").mkdir(exist_ok=True)
    os.environ["USERS_DB"] = "/store/users.db"

    chroma = Path("/store/chroma_db")
    marker = Path("/store/.ingested_docs")
    docs = sorted(str(p) for p in Path("/app/markdown_output").rglob("*.md")) + \
           sorted(str(p) for p in Path("/app/data/raw").glob("*.pdf"))
    fingerprint = str(hash(tuple(docs)))
    if not chroma.exists() or not any(chroma.iterdir()) or marker.read_text() != fingerprint if marker.exists() else True:
        print("Ingesting documents ...", flush=True)
        shutil.rmtree(chroma, ignore_errors=True)
        subprocess.run([sys.executable, "ingest.py"], check=False)
        marker.write_text(fingerprint)
        store.commit()

    from main import app as fastapi_app
    from rag import _collection, _embedder, _bm25
    print(f"Warm-up: {_collection().count()} chunks", flush=True)
    _embedder(); _bm25()
    return fastapi_app
