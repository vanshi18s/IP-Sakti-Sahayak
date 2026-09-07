"""
Run the golden question set and report the metrics named in the problem statement.

  python evaluate.py            -> citation correctness + safe abstention (fast, no extra deps)
  python evaluate.py --ragas    -> also RAGAS faithfulness + answer relevancy (pip install ragas langchain-groq)

Writes eval_results.json and docs/evaluation.md.
"""
import argparse
import json
import os
from datetime import date
from pathlib import Path

from rag import answer_question

ROOT = Path(__file__).parent.parent
GOLDEN = ROOT / "data" / "golden_questions.json"
OUT_JSON = Path(__file__).parent / "eval_results.json"
OUT_MD = ROOT / "docs" / "evaluation.md"


def cited_text(result: dict) -> str:
    return " ".join(f"{s['doc']} {s['section']}" for s in result["sources"]).lower()


def run_golden():
    items = json.loads(GOLDEN.read_text(encoding="utf-8"))
    rows, cite_hits, abstain_hits, abstain_total = [], 0, 0, 0
    for it in items:
        res = answer_question(it["q"], it.get("jurisdiction"))
        should_abstain = it["expect"].upper().startswith("ABSTAIN")
        if should_abstain:
            abstain_total += 1
            ok = res["abstained"]
            abstain_hits += ok
        else:
            key = it["expect"].split(",")[0].lower()
            ok = key in cited_text(res)
            cite_hits += ok
        rows.append({"question": it["q"], "jurisdiction": it.get("jurisdiction"), "expected": it["expect"],
                     "abstained": res["abstained"], "confidence": res["confidence"],
                     "sources": [f"{s['doc']} — {s['section']}" for s in res["sources"]],
                     "contexts": [s["snippet"] for s in res["sources"]],
                     "answer": res["answer"], "pass": bool(ok)})
        print(f"{'PASS' if ok else 'FAIL'}  {it['q'][:70]}")
    n_cite = len(items) - abstain_total
    summary = {
        "questions": len(items),
        "citation_correctness": round(cite_hits / n_cite, 3) if n_cite else None,
        "safe_abstention_rate": round(abstain_hits / abstain_total, 3) if abstain_total else None,
    }
    return summary, rows


def run_ragas(rows):
    """Faithfulness (answer grounded in retrieved context) and answer relevancy, judged by the Groq LLM."""
    from datasets import Dataset
    from ragas import evaluate
    from ragas.metrics import faithfulness, answer_relevancy
    from langchain_groq import ChatGroq
    from langchain_community.embeddings import HuggingFaceEmbeddings  # only for relevancy; small model
    import config

    answered = [r for r in rows if not r["abstained"] and r["contexts"]]
    ds = Dataset.from_dict({
        "question": [r["question"] for r in answered],
        "answer": [r["answer"] for r in answered],
        "contexts": [r["contexts"] for r in answered],
    })
    llm = ChatGroq(model=config.GROQ_MODEL, api_key=config.GROQ_API_KEY, temperature=0)
    emb = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    scores = evaluate(ds, metrics=[faithfulness, answer_relevancy], llm=llm, embeddings=emb)
    return {"faithfulness": round(float(scores["faithfulness"]), 3),
            "answer_relevancy": round(float(scores["answer_relevancy"]), 3),
            "ragas_questions": len(answered)}


def write_report(summary, rows):
    lines = [f"# Evaluation — {date.today().isoformat()}", "",
             "Metrics named in SIH26045: answer accuracy, citation correctness, safe abstention, multilingual quality.", "",
             "| Metric | Value |", "|---|---|"]
    for k, v in summary.items():
        lines.append(f"| {k.replace('_', ' ')} | {v} |")
    lines += ["", "| Question | Expected | Result | Confidence |", "|---|---|---|---|"]
    for r in rows:
        lines.append(f"| {r['question']} | {r['expected']} | {'PASS' if r['pass'] else 'FAIL'} | {r['confidence']} |")
    OUT_MD.parent.mkdir(exist_ok=True)
    OUT_MD.write_text("\n".join(lines), encoding="utf-8")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ragas", action="store_true", help="also compute RAGAS faithfulness/relevancy")
    args = parser.parse_args()

    summary, rows = run_golden()
    if args.ragas:
        try:
            summary.update(run_ragas(rows))
        except ImportError:
            print("RAGAS not installed: pip install ragas langchain-groq langchain-community sentence-transformers datasets")
    OUT_JSON.write_text(json.dumps({"summary": summary, "rows": rows}, indent=2), encoding="utf-8")
    write_report(summary, rows)
    print("\n", json.dumps(summary, indent=2), f"\nReport -> {OUT_MD}")


if __name__ == "__main__":
    main()
