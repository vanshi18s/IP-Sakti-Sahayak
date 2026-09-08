import { useState } from "react";
import { api } from "../api.js";

// One assistant turn: the answer hangs off a stem, each cited source is a leaf on it.
export default function AnswerMessage({ msg, onEscalate }) {
  const [active, setActive] = useState(null);
  const [escalated, setEscalated] = useState(false);
  const [escError, setEscError] = useState("");
  const r = msg.result;

  const jump = (id) => {
    setActive(id);
    document.getElementById(`${msg.id}-src-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const escalate = async () => {
    try {
      await api.escalate(msg.question, "user requested human review");
      setEscalated(true);
      setEscError("");
    } catch (e) {
      setEscError(e.message === "Login required" ? "Sign in to send this to a facilitator." : e.message);
    }
  };

  if (msg.loading) {
    return (
      <div className="stem py-2">
        {msg.partial ? (
          <>
            <div className="answer text-ink">{msg.partial}<span className="inline-block w-1.5 h-4 bg-sprout align-middle ml-0.5 animate-pulse" /></div>
            {msg.stage && <p className="text-[11px] text-ink-soft mt-2">{msg.stage}</p>}
          </>
        ) : (
          <p className="text-sm text-ink-soft flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-sprout animate-pulse" />
            {msg.stage || "Searching the statutes"}
          </p>
        )}
      </div>
    );
  }
  if (msg.error) {
    return (
      <div className="stem py-2">
        <p className="text-sm text-copper">
          The backend didn't respond. Check the terminal running the server, then ask again.
        </p>
      </div>
    );
  }

  const pct = Math.round((r.confidence || 0) * 100);
  const band = r.abstained ? "Abstained" : pct >= 70 ? "High" : pct >= 45 ? "Medium" : "Low";
  const bd = r.confidence_breakdown;

  return (
    <div className="stem settle">
      {msg.jurisdiction && (
        <div className="text-[11px] text-ink-soft mb-1">
          {msg.jurisdiction === "India" ? "Under Indian law" : "Under international regimes"}
        </div>
      )}

      {r.refused && (
        <div className="text-[11px] font-semibold text-copper mb-1">
          Not answered — {r.intent === "medical" ? "this asks for medical advice"
            : r.intent === "unsafe" ? "unsafe request" : "outside this assistant's scope"}
        </div>
      )}

      {r.resolved_question && (
        <div className="text-[11px] text-ink-soft mb-1">
          Read as: <span className="italic">{r.resolved_question}</span>
        </div>
      )}

      <div className={`answer ${r.abstained ? "text-ink-soft italic" : "text-ink"}`}>
        {renderAnswer(r.answer, jump)}
      </div>

      {r.answer_en && (
        <details className="mt-2 text-sm text-ink-soft">
          <summary className="cursor-pointer text-xs">English original</summary>
          <div className="answer mt-1">{renderAnswer(r.answer_en, jump)}</div>
        </details>
      )}

      {r.sources?.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {r.sources.map((s) => (
            <div
              key={s.id}
              id={`${msg.id}-src-${s.id}`}
              data-active={active === s.id}
              onMouseEnter={() => setActive(s.id)}
              onMouseLeave={() => setActive(null)}
              className={`leaf-node rounded-md px-3 py-2 border transition-colors ${
                active === s.id ? "bg-haldi-wash border-haldi/40" : "bg-paper border-patra-deep"
              }`}
            >
              <div className="text-sm">
                <span className="font-semibold text-haldi mr-1.5">{s.id}</span>
                <span className="font-semibold">{s.doc}</span>
              </div>
              <div className="text-[11px] text-ink-soft mt-0.5">
                {s.section !== "n/a" && <>{s.section} · </>}page {s.page} · {s.jurisdiction}
                {s.version_date && s.version_date !== "unknown" && <> · as at {s.version_date}</>}
              </div>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed line-clamp-2">{s.snippet}</p>
              {s.url && (
                <a href={s.url} target="_blank" rel="noreferrer"
                   className="text-[11px] font-semibold text-tulsi underline underline-offset-2 mt-1 inline-block">
                  Read the official text
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-ink-soft">
        <span title={bd ? `Retrieval ${Math.round(bd.retrieval_strength * 100)}% · relevant ${bd.passages_relevant} · cited ${bd.sources_cited}` : ""}
              className="flex items-center gap-1.5">
          <span className="inline-block w-16 h-1 bg-patra-deep rounded-full overflow-hidden align-middle">
            <span className="block h-full bg-haldi" style={{ width: `${pct}%` }} />
          </span>
          {band} · {pct}% grounded
        </span>
        <button onClick={escalate} disabled={escalated}
                className="underline underline-offset-2 hover:text-tulsi disabled:no-underline disabled:opacity-60">
          {escalated ? "Sent to a facilitator" : "Send to an IP facilitator"}
        </button>
        {escError && <span className="text-copper">{escError}</span>}
      </div>
    </div>
  );
}

function renderAnswer(text, onCite) {
  return String(text).split(/(\[\d+\])/g).map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{p}</span>;
    return (
      <button key={i} className="cite" onClick={() => onCite(Number(m[1]))} aria-label={`Source ${m[1]}`}>
        {m[1]}
      </button>
    );
  });
}
