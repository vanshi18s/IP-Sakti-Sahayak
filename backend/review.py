"""
Document review: user uploads a product sheet / formulation description (PDF or text).
We extract the text, summarise the product, and run targeted checks through the RAG pipeline:
  1. patentability + traditional-knowledge risk (s.3(p), s.3(e))
  2. regulatory category & licensing pathway
  3. ABS / biodiversity obligations
  4. advertising / claims restrictions
Each check is a normal cited answer, so the report inherits the same guardrails.
"""
import io
import re

from pypdf import PdfReader

from rag import _chat, answer_question

SUMMARY_SYS = (
    "You are reading a product or formulation document for an Ayurvedic product. "
    "Extract, in plain text without markdown: (1) product name, (2) ingredients / botanical names, "
    "(3) intended use or claims, (4) dosage form, (5) whether it cites a classical text. "
    "If something is missing say 'not stated'. Keep it under 120 words."
)

CHECKS = [
    ("Patentability and traditional-knowledge risk",
     "Given this product: {summary}\nCan this formulation or its components be patented in India, "
     "and does Section 3(p) (traditional knowledge) or Section 3(e) (mere admixture) of the Patents Act apply?"),
    ("Regulatory category and licensing",
     "Given this product: {summary}\nUnder the Drugs and Cosmetics Act and Rules, which category does it fall in "
     "(classical, proprietary, new drug, food, cosmetic) and what licence or approval is needed?"),
    ("Biodiversity and benefit-sharing (ABS)",
     "Given this product: {summary}\nDoes commercial use of these biological resources require approval or "
     "intimation under the Biological Diversity Act, and is benefit sharing payable?"),
    ("Advertising and claims",
     "Given this product: {summary}\nAre the stated claims permitted, or restricted under the Drugs and Magic "
     "Remedies (Objectionable Advertisements) Act or FSSAI/AYUSH advertising rules?"),
]


def extract_text(filename: str, data: bytes) -> str:
    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(data))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
    else:
        text = data.decode("utf-8", errors="ignore")
    text = re.sub(r"[ \t]+", " ", text)
    return text.strip()[:12000]  # cap for the LLM


def review_document(filename: str, data: bytes, jurisdiction: str = "India") -> dict:
    text = extract_text(filename, data)
    if len(text) < 40:
        return {"error": "Could not read enough text from the file. Is it a scanned PDF?"}

    summary = _chat(SUMMARY_SYS, text, max_tokens=600)

    checks = []
    for title, template in CHECKS:
        q = template.format(summary=summary)
        res = answer_question(q, jurisdiction)
        checks.append({
            "title": title,
            "answer": res["answer"],
            "abstained": res["abstained"],
            "confidence": res["confidence"],
            "sources": res["sources"],
        })

    flags = [c["title"] for c in checks if not c["abstained"] and c["confidence"] >= 0.45]
    return {
        "filename": filename,
        "chars_read": len(text),
        "product_summary": summary,
        "checks": checks,
        "areas_with_findings": flags,
        "disclaimer": "Automated review for information only. Confirm with the cited sources or a qualified professional.",
    }
