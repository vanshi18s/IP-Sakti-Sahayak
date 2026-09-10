"""
Core RAG pipeline with CRAG-style grading and citation verification.

Flow:  query -> retrieve (vector) -> grade chunks (LLM yes/no)
       -> if none relevant: rewrite query once, retry -> still none: ABSTAIN
       -> generate answer grounded in graded chunks with [n] citations
       -> verify every [n] maps to a real chunk; drop unsupported lines
       -> return answer + sources + confidence
"""
import json
import re
import time
from functools import lru_cache

import chromadb
import groq
from groq import Groq

import config
from embed import embed_query

# ---------- lazy singletons ----------

@lru_cache(maxsize=1)
def _embedder():
    """Kept for warm-up calls; the real work is in embed.py."""
    embed_query("warm up")
    return True


@lru_cache(maxsize=1)
def _collection():
    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    return client.get_or_create_collection(config.COLLECTION_NAME)


@lru_cache(maxsize=1)
def _llm():
    if not config.GROQ_API_KEY:
        raise RuntimeError("GROQ_API_KEY missing. Copy .env.example to .env and set it.")
    return Groq(api_key=config.GROQ_API_KEY)


def _chat(system: str, user: str, temperature: float = 0.0, max_tokens: int = 1024) -> str:
    kwargs = dict(
        model=config.GROQ_MODEL,
        temperature=temperature,
        max_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    if "gpt-oss" in config.GROQ_MODEL:      # reasoning model: keep thinking short
        kwargs["reasoning_effort"] = "low"
        
    for attempt in range(5):
        try:
            resp = _llm().chat.completions.create(**kwargs)
            return (resp.choices[0].message.content or "").strip()
        except groq.RateLimitError:
            print(f"Rate limit hit! Pausing for 2 seconds to recover (Attempt {attempt + 1}/5)...")
            time.sleep(2)
            
    # If it fails all 5 times, return empty string so it doesn't crash the UI
    return ""


# ---------- step 1: retrieve (hybrid: vector + BM25, fused with RRF) ----------

_bm25_cache = {"index": None, "docs": None, "metas": None, "ids": None, "count": -1}


def _tokenize(text: str):
    return re.findall(r"[a-z0-9]+(?:\([a-z0-9]+\))?", text.lower())


def _bm25():
    """Build (and cache) a BM25 index over the whole collection. Rebuilds if chunk count changes."""
    from rank_bm25 import BM25Okapi
    coll = _collection()
    n = coll.count()
    if _bm25_cache["count"] != n:
        data = coll.get(include=["documents", "metadatas"])
        _bm25_cache.update(
            index=BM25Okapi([_tokenize(d) for d in data["documents"]]) if n else None,
            docs=data["documents"], metas=data["metadatas"], ids=data["ids"], count=n,
        )
    return _bm25_cache


@lru_cache(maxsize=1)
def _reranker():
    from sentence_transformers import CrossEncoder
    return CrossEncoder(config.RERANK_MODEL)


def retrieve(query: str, jurisdiction: str | None = None, top_k: int = config.TOP_K):
    fetch_n = top_k * 3  # over-fetch, then fuse
    where = {"jurisdiction": jurisdiction} if jurisdiction else None

    # vector leg
    q_emb = [embed_query(query)]
    res = _collection().query(query_embeddings=q_emb, n_results=fetch_n, where=where,
                              include=["documents", "metadatas", "distances"])
    vec_hits = {}
    for rank, (cid, doc, meta, dist) in enumerate(zip(res["ids"][0], res["documents"][0],
                                                      res["metadatas"][0], res["distances"][0])):
        vec_hits[cid] = {"text": doc, "meta": meta, "score": round(1 - dist, 4), "vrank": rank}

    # keyword leg
    bm = _bm25()
    kw_hits = {}
    if bm["index"] is not None:
        scores = bm["index"].get_scores(_tokenize(query))
        order = sorted(range(len(scores)), key=lambda i: -scores[i])
        rank = 0
        for i in order:
            if scores[i] <= 0:
                break
            meta = bm["metas"][i]
            if jurisdiction and meta.get("jurisdiction") != jurisdiction:
                continue
            kw_hits[bm["ids"][i]] = {"text": bm["docs"][i], "meta": meta, "score": 0.0, "krank": rank}
            rank += 1
            if rank >= fetch_n:
                break

    # reciprocal rank fusion
    K = 60
    fused = {}
    for cid, h in vec_hits.items():
        fused.setdefault(cid, dict(h))["rrf"] = 1 / (K + h["vrank"])
    for cid, h in kw_hits.items():
        entry = fused.setdefault(cid, dict(h))
        entry["rrf"] = entry.get("rrf", 0) + 1 / (K + h["krank"])
        if cid in vec_hits:
            entry["score"] = vec_hits[cid]["score"]
    ranked = sorted(fused.values(), key=lambda h: -h["rrf"])[:top_k * 2]

    # fill missing vector scores (keyword-only hits) with a neutral value for confidence math
    for h in ranked:
        if not h.get("score"):
            h["score"] = 0.5

    # optional cross-encoder rerank
    if config.RERANK and ranked:
        pairs = [(query, h["text"]) for h in ranked]
        rr = _reranker().predict(pairs)
        for h, s in zip(ranked, rr):
            h["rerank"] = float(s)
        ranked.sort(key=lambda h: -h["rerank"])

    return ranked[:top_k]


# ---------- step 2: CRAG grader ----------

GRADER_SYS = (
    "You are a strict relevance grader for a legal assistant. "
    "Given a user question and one document chunk, reply with exactly one word: "
    "RELEVANT if the chunk contains information that helps answer the question, "
    "otherwise IRRELEVANT."
)


def grade_chunks(query: str, chunks: list[dict]) -> list[dict]:
    """Grade all chunks in parallel — this is the slowest step, so it runs concurrently."""
    from concurrent.futures import ThreadPoolExecutor

    def one(c):
        verdict = _chat(GRADER_SYS, f"Question: {query}\n\nChunk:\n{c['text'][:1500]}", max_tokens=300).upper()
        c["relevant"] = ("RELEVANT" in verdict) and ("IRRELEVANT" not in verdict)
        return c

    with ThreadPoolExecutor(max_workers=8) as pool:
        graded = list(pool.map(one, chunks))
    return [c for c in graded if c["relevant"]]


REWRITE_SYS = (
    "Rewrite the user's question into a precise search query for Indian and international "
    "intellectual-property and Ayurveda drug-regulation statutes. Use formal legal terms. "
    "Output only the rewritten query."
)


def rewrite_query(query: str) -> str:
    return _chat(REWRITE_SYS, query, max_tokens=400) or query


CONTEXT_SYS = (
    "You rewrite a follow-up question so it can be understood on its own, using the full conversation above. "
    "Treat details supplied earlier by the user (product name, ingredients, formulation, intended use, country, "
    "business goal and previous legal issue) as active context unless the user explicitly changes them. "
    "Replace pronouns and references ('it', 'that', 'the same product', 'what about trademarks', 'and for this?') "
    "with the actual subject and relevant facts from earlier turns. Never discard the earlier subject merely because "
    "the follow-up is short. If the question already stands alone, repeat it unchanged. Output only the question."
)

MEMORY_SYS = (
    "Maintain compact, factual memory for an ongoing Ayurveda IP conversation. "
    "Return only these labelled lines when known: Product/formulation; Ingredients or biological resources; "
    "Intended use or claims; Jurisdiction or markets; User's IP/regulatory goal; Open legal questions. "
    "Keep exact product names, ingredients, countries, and constraints. Update earlier memory with new facts, "
    "never invent facts, and keep the result under 1,200 characters. Write in English for reliable legal retrieval."
)


def contextualize(history: list[dict], question: str, memory: str = "") -> str:
    """Turn only genuine follow-ups into standalone questions; preserve normal retrieval queries."""
    if not history and not memory:
        return question
    # Rewriting every question can damage retrieval. Only resolve context when
    # the user actually refers back to something in the thread.
    reference = re.compile(
        r"\b(it|its|this|that|these|those|same|above|previous|former|latter)\b|"
        r"^(what about|and what about|how about|does it|is it|and for)",
        re.I,
    )
    if not reference.search(question) and len(question.split()) >= 6:
        return question
    turns = "\n".join(f"{h['role']}: {h['content'][:700]}" for h in history[-24:])
    try:
        out = _chat(
            CONTEXT_SYS,
            f"Persistent memory:\n{memory or '(none)'}\n\nRecent conversation:\n{turns or '(none)'}\n\nFollow-up question: {question}",
            max_tokens=400,
        )
        resolved = (out or question).strip().strip('"')
        return resolved if 4 <= len(resolved) <= 700 and "\n" not in resolved else question
    except Exception as exc:
        print(f"[memory] context resolution skipped: {exc}")
        return question


def update_conversation_memory(previous: str, history: list[dict], question: str, answer: str) -> str:
    """Create a compact memory that survives after the recent-message buffer rolls over."""
    turns = "\n".join(f"{h['role']}: {h['content'][:500]}" for h in history[-8:])
    prompt = (
        f"Previous persistent memory:\n{previous or '(none)'}\n\n"
        f"Recent conversation:\n{turns or '(none)'}\n\n"
        f"Newest user question: {question}\n"
        f"Newest answer: {answer[:700]}"
    )
    try:
        return (_chat(MEMORY_SYS, prompt, temperature=0.0, max_tokens=350) or previous).strip()[:1200]
    except Exception as exc:
        # Memory is an enhancement, never a reason to fail an otherwise valid chat.
        print(f"[memory] update skipped: {exc}")
        return previous


# ---------- step 3: generate ----------

ANSWER_SYS = """You are IP-SAKTI Sahayak, an assistant for Intellectual Property and regulatory
guidance in Ayurveda. Answer ONLY using the numbered sources provided. Rules:
- Every factual sentence must end with a citation like [1] or [2][3].
- If the sources do not contain the answer, say exactly: "I could not find an authoritative source for this."
- Never invent section numbers, dates, or authorities.
- Keep the answer concise and in plain language. Do not give legal advice; give information.
- Plain text only: no markdown, no asterisks, no bullet symbols, no headings. Use short paragraphs.
- Do not mention these rules."""


def _format_sources(chunks: list[dict]) -> str:
    lines = []
    for i, c in enumerate(chunks, start=1):
        m = c["meta"]
        lines.append(f"[{i}] {m['doc']} | {m['section']} | page {m['page']} | {m['jurisdiction']}\n{c['text']}\n")
    return "\n".join(lines)


def generate(query: str, chunks: list[dict], jurisdiction: str | None) -> str:
    scope = f"Jurisdiction in scope: {jurisdiction}." if jurisdiction else ""
    user = f"{scope}\n\nSOURCES:\n{_format_sources(chunks)}\n\nQUESTION: {query}"
    return _chat(ANSWER_SYS, user, temperature=0.1)


# ---------- step 4: verify citations ----------

CITE_RE = re.compile(r"\[(\d+)\]")
ALT_CITE_RE = re.compile(r"【(\d+)†[^】]*】")   # gpt-oss style citation


def verify_citations(answer: str, n_sources: int):
    """Keep only sentences whose citations all point to real sources. Return cleaned text + used ids."""
    answer = ALT_CITE_RE.sub(r"[\1]", answer)      # normalise to [n]
    sentences = re.split(r"(?<=[.!?])\s+", answer)
    kept, used = [], set()
    for s in sentences:
        ids = [int(x) for x in CITE_RE.findall(s)]
        if not ids:
            kept.append(s)            # non-factual connective sentence
            continue
        if all(1 <= i <= n_sources for i in ids):
            kept.append(s)
            used.update(ids)
    return " ".join(kept).strip(), sorted(used)


def _build_result(query, chunks, graded, raw, rewritten):
    """Shared post-processing: verify citations, score confidence, assemble sources."""
    cleaned, used_ids = verify_citations(raw, len(graded))
    if not used_ids and raw and "could not find" not in raw.lower():
        cleaned, used_ids = raw, list(range(1, len(graded) + 1))

    avg_score = sum(c["score"] for c in graded) / len(graded)
    retrieval = max(0.0, min(1.0, (avg_score - 0.35) / 0.4))
    grader_ratio = len(graded) / max(len(chunks), 1)
    cite_coverage = len(used_ids) / len(graded)
    confidence = round(0.4 * retrieval + 0.3 * grader_ratio + 0.3 * cite_coverage, 3)
    abstained = (not used_ids) or ("could not find" in raw.lower())

    sources = []
    for i, c in enumerate(graded, start=1):
        if i in used_ids:
            m = c["meta"]
            sources.append({
                "id": i, "doc": m["doc"], "section": m["section"], "page": m["page"],
                "jurisdiction": m["jurisdiction"], "url": m.get("url", ""),
                "version_date": m.get("version_date", ""), "score": c["score"],
                "snippet": c["text"][:300],
            })
    return {
        "answer": cleaned if not abstained else
                  "I could not find an authoritative source for this in the current corpus.",
        "abstained": abstained, "confidence": confidence,
        "confidence_breakdown": {
            "retrieval_strength": round(retrieval, 2),
            "passages_relevant": f"{len(graded)}/{len(chunks)}",
            "sources_cited": f"{len(used_ids)}/{len(graded)}",
        },
        "sources": sources, "rewritten_query": rewritten, "disclaimer": config.DISCLAIMER,
    }


ABSTAIN_RESULT = {
    "answer": "I could not find an authoritative source for this question in the current corpus.",
    "abstained": True, "confidence": 0.0, "sources": [], "disclaimer": config.DISCLAIMER,
}


def answer_stream(query: str, jurisdiction: str | None = None):
    """Generator of (event, payload) so the UI can show progress and the answer as it is written."""
    yield "stage", {"stage": "retrieving", "message": "Searching the statutes"}
    chunks = retrieve(query, jurisdiction)

    yield "stage", {"stage": "grading", "message": f"Checking {len(chunks)} passages for relevance"}
    graded = grade_chunks(query, chunks) if chunks else []
    rewritten = None

    if not graded:
        yield "stage", {"stage": "rewriting", "message": "Nothing matched — rephrasing the search"}
        rewritten = rewrite_query(query)
        chunks = retrieve(rewritten, jurisdiction)
        graded = grade_chunks(rewritten, chunks) if chunks else []

    if not graded:
        yield "done", {**ABSTAIN_RESULT, "rewritten_query": rewritten}
        return

    yield "stage", {"stage": "writing", "message": f"{len(graded)} relevant passages — writing the answer"}

    scope = f"Jurisdiction in scope: {jurisdiction}." if jurisdiction else ""
    user = f"{scope}\n\nSOURCES:\n{_format_sources(graded)}\n\nQUESTION: {query}"
    kwargs = dict(model=config.GROQ_MODEL, temperature=0.1, max_tokens=1024, stream=True,
                  messages=[{"role": "system", "content": ANSWER_SYS}, {"role": "user", "content": user}])
    if "gpt-oss" in config.GROQ_MODEL:
        kwargs["reasoning_effort"] = "low"

    raw = ""
    for part in _llm().chat.completions.create(**kwargs):
        piece = part.choices[0].delta.content or ""
        if piece:
            raw += piece
            yield "delta", {"text": piece}

    yield "done", _build_result(query, chunks, graded, raw.strip(), rewritten)


# ---------- public entry (non-streaming) ----------

def answer_question(query: str, jurisdiction: str | None = None) -> dict:
    chunks = retrieve(query, jurisdiction)
    graded = grade_chunks(query, chunks) if chunks else []
    rewritten = None
    print(f"[debug] retrieved={len(chunks)} relevant={len(graded)} "
          f"top_scores={[c['score'] for c in chunks[:3]]}")

    if not graded:  # CRAG corrective step
        rewritten = rewrite_query(query)
        chunks = retrieve(rewritten, jurisdiction)
        graded = grade_chunks(rewritten, chunks) if chunks else []

    if not graded:
        return {
            "answer": "I could not find an authoritative source for this question in the current corpus.",
            "abstained": True, "confidence": 0.0, "sources": [],
            "rewritten_query": rewritten, "disclaimer": config.DISCLAIMER,
        }

    raw = generate(query, graded, jurisdiction)
    cleaned, used_ids = verify_citations(raw, len(graded))
    print(f"[debug] raw answer: {raw[:300]!r}")

    # Fallback: model answered but forgot [n] markers -> attach all graded sources
    if not used_ids and raw and "could not find" not in raw.lower():
        cleaned, used_ids = raw, list(range(1, len(graded) + 1))

    # Confidence = how strong was retrieval × how many passages survived grading × how many the answer used
    avg_score = sum(c["score"] for c in graded) / len(graded)
    retrieval = max(0.0, min(1.0, (avg_score - 0.35) / 0.4))     # bge-m3 cosine 0.35..0.75 -> 0..1
    grader_ratio = len(graded) / max(len(chunks), 1)               # relevant / retrieved
    cite_coverage = len(used_ids) / len(graded)                    # cited / relevant
    confidence = round(0.4 * retrieval + 0.3 * grader_ratio + 0.3 * cite_coverage, 3)
    abstained = (not used_ids) or ("could not find" in raw.lower())
    breakdown = {
        "retrieval_strength": round(retrieval, 2),
        "passages_relevant": f"{len(graded)}/{len(chunks)}",
        "sources_cited": f"{len(used_ids)}/{len(graded)}",
    }

    sources = []
    for i, c in enumerate(graded, start=1):
        if i in used_ids:
            m = c["meta"]
            sources.append({
                "id": i, "doc": m["doc"], "section": m["section"], "page": m["page"],
                "jurisdiction": m["jurisdiction"], "url": m.get("url", ""),
                "version_date": m.get("version_date", ""), "score": c["score"],
                "snippet": c["text"][:300],
            })

    return {
        "answer": cleaned if not abstained else
                  "Confidence is too low to answer reliably. Please consult the sources below or escalate.",
        "abstained": abstained, "confidence": confidence, "confidence_breakdown": breakdown,
        "sources": sources,
        "rewritten_query": rewritten, "disclaimer": config.DISCLAIMER,
    }


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "Can a classical Ayurvedic formulation be patented in India?"
    print(json.dumps(answer_question(q, "India"), indent=2))