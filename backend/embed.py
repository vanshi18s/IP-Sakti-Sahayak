"""
Embedding backend switch.

EMBED_BACKEND=local  -> sentence-transformers (bge-m3) on this machine (needs ~3 GB RAM)
EMBED_BACKEND=jina   -> Jina AI API (jina-embeddings-v3, multilingual, 1024-dim, free tier, no card)
                        set JINA_API_KEY in .env  (get at https://jina.ai/embeddings)

Both return L2-normalised vectors so cosine == dot product in Chroma.
"""
import os
from functools import lru_cache

import config

BACKEND = os.getenv("EMBED_BACKEND", "local").lower()
JINA_KEY = os.getenv("JINA_API_KEY", "")
JINA_MODEL = os.getenv("JINA_MODEL", "jina-embeddings-v3")


@lru_cache(maxsize=1)
def _local():
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(config.EMBED_MODEL)


def _jina(texts: list[str], task: str) -> list[list[float]]:
    import time
    import httpx
    if not JINA_KEY:
        raise RuntimeError("JINA_API_KEY missing in .env")
    out = []
    for i in range(0, len(texts), 64):
        batch = texts[i:i + 64]
        for attempt in range(8):
            r = httpx.post(
                "https://api.jina.ai/v1/embeddings",
                headers={"Authorization": f"Bearer {JINA_KEY}", "Content-Type": "application/json"},
                json={"model": JINA_MODEL, "task": task, "normalized": True, "input": batch},
                timeout=120,
            )
            if r.status_code == 429 or r.status_code >= 500:
                wait = int(r.headers.get("Retry-After", 0)) or min(60, 5 * (attempt + 1))
                print(f"  [jina] {r.status_code}, retrying in {wait}s ...", flush=True)
                time.sleep(wait)
                continue
            r.raise_for_status()
            out += [d["embedding"] for d in r.json()["data"]]
            break
        else:
            raise RuntimeError("Jina API kept failing after retries")
        time.sleep(0.5)  # stay under the free-tier rate limit
    return out


def embed_docs(texts: list[str]) -> list[list[float]]:
    if BACKEND == "jina":
        return _jina(texts, "retrieval.passage")
    return _local().encode(texts, normalize_embeddings=True).tolist()


def embed_query(text: str) -> list[float]:
    if BACKEND == "jina":
        return _jina([text], "retrieval.query")[0]
    return _local().encode([text], normalize_embeddings=True).tolist()[0]
