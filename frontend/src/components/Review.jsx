import { useState } from "react";
import { api } from "../api.js";
import { exportReview } from "../report.js";
import SourceCard from "./SourceCard.jsx";

// Upload a product sheet / formulation PDF and get four targeted, cited checks.
export default function Review({ user }) {
  const [file, setFile] = useState(null);
  const [jurisdiction, setJurisdiction] = useState("India");
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const r = await api.review(file, jurisdiction);
      if (r.error) setError(r.error);
      else setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Upload your product sheet, formulation description or label (PDF or .txt). We'll summarise the product and
        run four checks — patentability, regulatory category, biodiversity obligations, and advertising claims — each
        with its sources.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm px-4 py-2 rounded-md border border-sage-deep bg-paper cursor-pointer hover:border-leaf">
          {file ? file.name : "Choose file"}
          <input type="file" accept=".pdf,.txt,.md" className="sr-only"
                 onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        <select value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}
                className="bg-paper border border-sage-deep rounded-md px-2 py-2 text-sm">
          <option>India</option>
          <option>International</option>
        </select>
        <button onClick={run} disabled={!file || busy}
                className="text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40">
          {busy ? "Reviewing… (about a minute)" : "Review document"}
        </button>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      {result && (
        <div className="flex flex-col gap-4">
          <div className="border-l-4 border-saffron bg-paper rounded-r-md p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl text-leaf">What we understood</h3>
              <button onClick={() => exportReview(result, user)}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-leaf text-leaf hover:bg-leaf hover:text-paper">
                Download report (PDF)
              </button>
            </div>
            <p className="text-sm whitespace-pre-wrap mt-2">{result.product_summary}</p>
            {result.areas_with_findings.length > 0 && (
              <p className="text-xs text-ink-soft mt-2">Findings in: {result.areas_with_findings.join(" · ")}</p>
            )}
          </div>

          {result.checks.map((c) => (
            <section key={c.title} className="bg-paper/70 border border-sage-deep rounded-lg p-4 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h3 className="text-lg text-leaf">{c.title}</h3>
                <span className="text-xs text-ink-soft">
                  {c.abstained ? "No source found" : `Confidence ${Math.round(c.confidence * 100)}%`}
                </span>
              </div>
              <p className={`text-[15px] whitespace-pre-wrap ${c.abstained ? "text-ink-soft italic" : ""}`}>{c.answer}</p>
              {c.sources.length > 0 && (
                <div className="flex flex-col gap-2 mt-1">
                  {c.sources.map((s) => <SourceCard key={s.id} source={s} />)}
                </div>
              )}
            </section>
          ))}
          <p className="text-[11px] text-ink-soft">{result.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
