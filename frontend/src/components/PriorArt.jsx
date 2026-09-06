import { useState } from "react";
import { api } from "../api.js";

// Prior-art pointer: search the indexed Ayurveda research bibliography.
export default function PriorArt() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const r = await api.priorArt(text);
      setRows(r.results);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Describe your formulation or ingredient. We'll show published research that may count as prior art
        under Patents Act s.3(p) and point you to TKDL for the classical record.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. Standardised Tinospora cordifolia (Guduchi) extract for blood-sugar control"
        className="w-full bg-paper border border-sage-deep rounded-md p-3 text-sm focus:border-leaf"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={search}
          disabled={loading}
          className="text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40"
        >
          {loading ? "Searching…" : "Find prior art"}
        </button>
        <a href="https://tkdl.res.in" target="_blank" rel="noreferrer" className="text-sm text-leaf underline underline-offset-2">
          Check TKDL
        </a>
      </div>

      {rows && rows.length === 0 && (
        <p className="text-sm text-ink-soft">No matching research found in the indexed bibliography.</p>
      )}
      {rows && rows.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rows.map((r, i) => (
            <li key={i} className="bg-paper border border-sage-deep rounded-md p-3">
              <div className="text-sm font-semibold">{r.title}</div>
              <div className="text-xs text-ink-soft mt-0.5">
                {[r.authors, r.journal, r.year].filter(Boolean).join(" · ")}
                <span className="ml-2 text-saffron font-semibold">{Math.round(r.similarity * 100)}% match</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
