"""
IP-SAKTI Sahayak backend.

Run:  uvicorn main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
import json
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import Depends, FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import config
import auth
from auth import UserOut, current_user, require_role
from classify import QUESTIONS, classify
from compare import compare_answers
from fees import estimate
from review import review_document
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
auth.init_db()


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


# ---------- auth routes ----------

@app.post("/auth/register", response_model=UserOut)
def auth_register(data: auth.RegisterIn):
    user = auth.register(data)
    _audit("register", {"user_id": user.id, "role": user.role})
    return user


@app.post("/auth/login")
def auth_login(data: auth.LoginIn):
    out = auth.login(data)
    _audit("login", {"user_id": out["user"].id})
    return out


@app.get("/auth/me", response_model=UserOut)
def auth_me(user: UserOut = Depends(auth.require_user)):
    return user


# ---------- routes ----------

@app.get("/health")
def health():
    return {"status": "ok", "chunks_in_corpus": _collection().count()}


@app.post("/chat")
def chat(req: ChatRequest, user: Optional[UserOut] = Depends(current_user)):
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
    _audit("chat", {"user_id": user.id if user else None, "query": req.query, "lang": detected,
                    "jurisdiction": req.jurisdiction,
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
def escalate(req: EscalateRequest, user: UserOut = Depends(auth.require_user)):
    _audit("escalate", {"user_id": user.id, "email": user.email, **req.model_dump()})
    return {"status": "logged", "message": "Your query has been queued for a human IP facilitator."}


@app.get("/escalations")
def escalations(user: UserOut = Depends(require_role("facilitator", "admin"))):
    """Facilitators see the queue of escalated questions."""
    if not LOG_FILE.exists():
        return []
    rows = [json.loads(l) for l in LOG_FILE.read_text(encoding="utf-8").splitlines() if l.strip()]
    return [r for r in rows if r.get("event") == "escalate"][::-1]


# ---------- document review + compare ----------

@app.post("/review")
async def review(file: UploadFile = File(...), jurisdiction: str = Form("India"),
                 user: Optional[UserOut] = Depends(current_user)):
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        return {"error": "File too large (max 5 MB)."}
    result = review_document(file.filename, data, jurisdiction)
    _audit("review", {"user_id": user.id if user else None, "filename": file.filename,
                      "findings": result.get("areas_with_findings", [])})
    return result


class CompareRequest(BaseModel):
    question: str
    india: str
    international: str


@app.post("/compare")
def compare(req: CompareRequest):
    return {"differences": compare_answers(req.question, req.india, req.international)}


# ---------- fee estimator ----------

class FeeRequest(BaseModel):
    ip_type: Literal["patent", "trademark", "gi"] = "patent"
    applicant: Literal["small", "other"] = "small"
    filing_mode: Literal["e", "physical"] = "e"
    sheets: int = 30
    claims: int = 10
    examination: Literal["none", "normal", "expedited"] = "normal"
    early_publication: bool = False
    renewal_years: int = 0
    tm_classes: int = 1
    gi_authorised_users: int = 0


@app.post("/fees")
def fees(req: FeeRequest):
    return estimate(**req.model_dump())
