"""
IP-SAKTI Sahayak backend.

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
from classify import QUESTIONS, classify
from prior_art import search_prior_art
from rag import answer_question, _collection

app = FastAPI(title="IP-SAKTI Sahayak API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)

LOG_FILE = Path(__file__).parent / "audit_log.jsonl"


def _audit(event: str, payload: dict):
    """Minimal audit trail (DPDP-aligned: no PII stored beyond the query itself)."""
    with LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps({"ts": datetime.utcnow().isoformat(), "event": event, **payload}) + "\n")


# ---------- schemas ----------

class ChatRequest(BaseModel):
    query: str
    jurisdiction: Optional[Literal["India", "International"]] = None
    lang: str = "en"           # translation hook for later (Bhashini / IndicTrans2)
    category: Optional[str] = None


class ClassifyRequest(BaseModel):
    answers: dict


class PriorArtRequest(BaseModel):
    text: str
    k: int = 8


class EscalateRequest(BaseModel):
    query: str
    reason: Optional[str] = None
    contact: Optional[str] = None


# ---------- routes ----------

@app.get("/health")
def health():
    return {"status": "ok", "chunks_in_corpus": _collection().count()}


@app.post("/chat")
def chat(req: ChatRequest):
    q = req.query
    if req.category:
        q = f"[Product category: {req.category}] {q}"
    result = answer_question(q, req.jurisdiction)
    result["jurisdiction"] = req.jurisdiction
    _audit("chat", {"query": req.query, "jurisdiction": req.jurisdiction,
                    "confidence": result["confidence"], "abstained": result["abstained"]})
    return result


@app.get("/classify/questions")
def classify_questions():
    return QUESTIONS


@app.post("/classify")
def classify_product(req: ClassifyRequest):
    result = classify(req.answers)
    _audit("classify", {"category": result["category_key"]})
    return result


@app.post("/prior-art")
def prior_art(req: PriorArtRequest):
    return {"results": search_prior_art(req.text, req.k)}


@app.get("/sources")
def sources():
    """List distinct documents in the corpus with version info."""
    coll = _collection()
    if coll.count() == 0:
        return []
    metas = coll.get(include=["metadatas"])["metadatas"]
    seen = {}
    for m in metas:
        seen.setdefault(m["doc"], {"doc": m["doc"], "jurisdiction": m["jurisdiction"],
                                   "doc_type": m["doc_type"], "version_date": m.get("version_date", ""),
                                   "url": m.get("url", "")})
    return sorted(seen.values(), key=lambda x: x["doc"])


@app.post("/escalate")
def escalate(req: EscalateRequest):
    _audit("escalate", req.model_dump())
    return {"status": "logged", "message": "Your query has been queued for a human IP facilitator."}
