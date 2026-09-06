"""
Prior-art pointer over the Ayurveda research-article bibliography CSV.

Put ayurveda_drug_research_final.csv in data/raw/. On first call it builds a separate
Chroma collection of article titles; later calls just search it.
"""
import csv
from functools import lru_cache

import chromadb
from sentence_transformers import SentenceTransformer

import config

CSV_PATH = config.RAW_DIR / "ayurveda_drug_research_final.csv"
COLL = "prior_art_articles"


@lru_cache(maxsize=1)
def _embedder():
    return SentenceTransformer(config.EMBED_MODEL)


@lru_cache(maxsize=1)
def _collection():
    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    coll = client.get_or_create_collection(COLL, metadata={"hnsw:space": "cosine"})
    if coll.count() == 0 and CSV_PATH.exists():
        _build(coll)
    return coll


def _build(coll):
    docs, metas, ids = [], [], []
    with open(CSV_PATH, encoding="utf-8", errors="ignore") as f:
        for i, row in enumerate(csv.DictReader(f)):
            title = (row.get("Article Title") or "").strip()
            if not title:
                continue
            docs.append(title)
            metas.append({
                "authors": row.get("Authors") or "",
                "journal": row.get("Journal Name") or "",
                "year": row.get("Year") or "",
            })
            ids.append(f"art_{i}")
    for s in range(0, len(docs), 512):
        emb = _embedder().encode(docs[s:s + 512], normalize_embeddings=True).tolist()
        coll.upsert(documents=docs[s:s + 512], embeddings=emb,
                    metadatas=metas[s:s + 512], ids=ids[s:s + 512])
    print(f"prior-art index built with {len(docs)} titles")


def search_prior_art(text: str, k: int = 8) -> list[dict]:
    coll = _collection()
    if coll.count() == 0:
        return []
    emb = _embedder().encode([text], normalize_embeddings=True).tolist()
    res = coll.query(query_embeddings=emb, n_results=k, include=["documents", "metadatas", "distances"])
    out = []
    for d, m, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        out.append({"title": d, **m, "similarity": round(1 - dist, 3)})
    return out


if __name__ == "__main__":
    for r in search_prior_art("Tinospora cordifolia (Guduchi) extract for diabetes"):
        print(r)
