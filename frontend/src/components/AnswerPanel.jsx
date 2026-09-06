import { useState } from "react";
import SourceCard from "./SourceCard.jsx";
import { api } from "../api.js";

// Turn "[1]" markers into clickable chips that scroll to the matching source card.
function renderAnswer(text, onCite) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{p}</span>;
    return (
      <span key={i} className="cite" onClick={() => onCite(Number(m[1]))}>
        {m[1]}
      </span>
    );
  });
}

function Confidence({ value, abstained }) {
  const pct = Math.round(value * 100);
  const label = abstained ? "Abstained" : pct >= 70 ? "High" : pct >= 45 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2 text-xs text-ink-soft">
      <span>Confidence</span>
      <div className="w-24 h-1.5 bg-sage-deep rounded-full overflow-hidden">
        <div className="h-full bg-saffron" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-semibold text-ink">{label} · {pct}%</span>
    </div>
  );
}

// One answer panel for one jurisdiction. Shown twice when "Both" is selected.
export default function AnswerPanel({ title, result, query, loading, error }) {
  const [hover, setHover] = useState(null);
  const [escalated, setEscalated] = useState(false);

  const scrollTo = (id) => {
    setHover(id);
    document.getElementById(`src-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const escalate = async () => {
    await api.escalate(query, "user requested human review");
    setEscalated(true);
  };

  return (
    <section className="bg-paper/70 border border-sage-deep rounded-lg p-4 flex flex-col gap-3 min-h-40">
      <div className="flex items-center justify-between">
        <h3 className="text-lg text-leaf">{title}</h3>
        {result && <Confidence value={result.confidence} abstained={result.abstained} />}
      </div>

      {loading && <p className="text-sm text-ink-soft">Reading the statutes…</p>}
      {error && <p className="text-sm text-danger">Could not reach the backend. Is uvicorn running on port 8000?</p>}

      {result && (
        <>
          <div className={`answer text-[15px] ${result.abstained ? "text-ink-soft italic" : "text-ink"}`}>
            {renderAnswer(result.answer, scrollTo)}
          </div>

          {result.answer_en && (
            <details className="text-sm text-ink-soft">
              <summary className="cursor-pointer text-xs font-semibold">Show English original</summary>
              <div className="answer mt-2">{renderAnswer(result.answer_en, scrollTo)}</div>
            </details>
          )}

          {result.sources?.length > 0 && (
            <div className="flex flex-col gap-2 mt-1">
              <span className="text-xs font-semibold text-ink-soft">Sources cited</span>
              {result.sources.map((s) => (
                <SourceCard key={s.id} source={s} highlighted={hover === s.id} onHover={setHover} />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between mt-auto pt-2 border-t border-sage-deep">
            <p className="text-[11px] text-ink-soft max-w-[70%]">{result.disclaimer}</p>
            <button
              onClick={escalate}
              disabled={escalated}
              className="text-xs font-semibold px-3 py-1.5 rounded-md border border-leaf text-leaf hover:bg-leaf hover:text-paper disabled:opacity-50"
            >
              {escalated ? "Sent to IP facilitator" : "Ask an IP facilitator"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
