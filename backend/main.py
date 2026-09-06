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
from abs_check import QUESTIONS as ABS_QUESTIONS, abs_check
from prior_art import search_prior_art
from rag import answer_question, _collection
from translate import to_english, from_english

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
    lang: str = "auto"         # "auto" detects script; or "en", "hi", "ta", ...
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
    # 1. translate in (auto-detect if lang == "auto")
    src = None if req.lang in ("auto", "", None) else req.lang
    q_en, detected = to_english(req.query, src)

    # 2. answer in English
    q = f"[Product category: {req.category}] {q_en}" if req.category else q_en
    result = answer_question(q, req.jurisdiction)

    # 3. translate out
    if detected != "en":
        result["answer_en"] = result["answer"]
        result["answer"] = from_english(result["answer"], detected)

    result["jurisdiction"] = req.jurisdiction
    result["language"] = detected
    result["query_en"] = q_en
    _audit("chat", {"query": req.query, "lang": detected, "jurisdiction": req.jurisdiction,
                    "confidence": result["confidence"], "abstained": result["abstained"]})
    return result


@app.get("/classify/questions")
def classify_questions():
    return QUESTIONS


@app.get("/abs/questions")
def abs_questions():
    return ABS_QUESTIONS


@app.post("/abs")
def abs_compliance(req: ClassifyRequest):
    result = abs_check(req.answers)
    _audit("abs", {"likely_requirement": result["likely_requirement"]})
    return result


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
