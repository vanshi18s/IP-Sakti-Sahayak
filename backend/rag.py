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
from functools import lru_cache

import chromadb
from groq import Groq
from sentence_transformers import SentenceTransformer

import config

# ---------- lazy singletons ----------

@lru_cache(maxsize=1)
def _embedder():
    return SentenceTransformer(config.EMBED_MODEL)


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
    resp = _llm().chat.completions.create(**kwargs)
    return (resp.choices[0].message.content or "").strip()


# ---------- step 1: retrieve ----------

def retrieve(query: str, jurisdiction: str | None = None, top_k: int = config.TOP_K):
    where = {"jurisdiction": jurisdiction} if jurisdiction else None
    q_emb = _embedder().encode([query], normalize_embeddings=True).tolist()
    res = _collection().query(
        query_embeddings=q_emb, n_results=top_k, where=where,
        include=["documents", "metadatas", "distances"],
    )
    chunks = []
    for doc, meta, dist in zip(res["documents"][0], res["metadatas"][0], res["distances"][0]):
        chunks.append({"text": doc, "meta": meta, "score": round(1 - dist, 4)})  # cosine sim
    return chunks


# ---------- step 2: CRAG grader ----------

GRADER_SYS = (
    "You are a strict relevance grader for a legal assistant. "
    "Given a user question and one document chunk, reply with exactly one word: "
    "RELEVANT if the chunk contains information that helps answer the question, "
    "otherwise IRRELEVANT."
)


def grade_chunks(query: str, chunks: list[dict]) -> list[dict]:
    kept = []
    for c in chunks:
        verdict = _chat(GRADER_SYS, f"Question: {query}\n\nChunk:\n{c['text'][:1500]}", max_tokens=300)
        v = verdict.upper()
        c["relevant"] = ("RELEVANT" in v) and ("IRRELEVANT" not in v)
        if c["relevant"]:
            kept.append(c)
    return kept


REWRITE_SYS = (
    "Rewrite the user's question into a precise search query for Indian and international "
    "intellectual-property and Ayurveda drug-regulation statutes. Use formal legal terms. "
    "Output only the rewritten query."
)


def rewrite_query(query: str) -> str:
    return _chat(REWRITE_SYS, query, max_tokens=400) or query


# ---------- step 3: generate ----------

ANSWER_SYS = """You are IP-SAKTI Sahayak, an assistant for Intellectual Property and regulatory
guidance in Ayurveda. Answer ONLY using the numbered sources provided. Rules:
- Every factual sentence must end with a citation like [1] or [2][3].
- If the sources do not contain the answer, say exactly: "I could not find an authoritative source for this."
- Never invent section numbers, dates, or authorities.
- Keep the answer concise and in plain language. Do not give legal advice; give information.
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


def verify_citations(answer: str, n_sources: int):
    """Keep only sentences whose citations all point to real sources. Return cleaned text + used ids."""
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


# ---------- public entry ----------

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

    # bge-m3 cosine sims typically sit in 0.4-0.8; rescale to 0-1
    avg_score = sum(c["score"] for c in graded) / len(graded)
    scaled = max(0.0, min(1.0, (avg_score - 0.35) / 0.4))
    cite_ratio = len(used_ids) / len(graded)
    confidence = round(0.5 * scaled + 0.5 * cite_ratio, 3)
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
                  "Confidence is too low to answer reliably. Please consult the sources below or escalate.",
        "abstained": abstained, "confidence": confidence, "sources": sources,
        "rewritten_query": rewritten, "disclaimer": config.DISCLAIMER,
    }


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "Can a classical Ayurvedic formulation be patented in India?"
    print(json.dumps(answer_question(q, "India"), indent=2))
