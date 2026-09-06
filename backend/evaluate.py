"""
Run the golden question set and report the metrics named in the problem statement:
  - answer accuracy (manual column left for you to fill)
  - citation correctness (expected source appears among cited docs/sections)
  - safe abstention (out-of-scope questions get abstained)

Usage: python evaluate.py   -> writes eval_results.json next to this file
"""
import json
from pathlib import Path

from rag import answer_question

GOLDEN = Path(__file__).parent.parent / "data" / "golden_questions.json"
OUT = Path(__file__).parent / "eval_results.json"


def cited_text(result: dict) -> str:
    return " ".join(f"{s['doc']} {s['section']}" for s in result["sources"]).lower()


def main():
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
            key = it["expect"].split(",")[0].lower()   # e.g. "patents act 1970"
            ok = key in cited_text(res)
            cite_hits += ok
        rows.append({"question": it["q"], "expected": it["expect"], "abstained": res["abstained"],
                     "confidence": res["confidence"], "sources": [f"{s['doc']} {s['section']}" for s in res["sources"]],
                     "pass": bool(ok), "answer": res["answer"], "accuracy_manual": None})
        print(f"{'PASS' if ok else 'FAIL'}  {it['q'][:70]}")

    n_cite = len(items) - abstain_total
    summary = {
        "citation_correctness": round(cite_hits / n_cite, 3) if n_cite else None,
        "safe_abstention_rate": round(abstain_hits / abstain_total, 3) if abstain_total else None,
        "total": len(items),
    }
    OUT.write_text(json.dumps({"summary": summary, "rows": rows}, indent=2), encoding="utf-8")
    print("\n", json.dumps(summary, indent=2), f"\nDetails -> {OUT}")


if __name__ == "__main__":
    main()
