import { useState } from "react";
import { api } from "../api.js";

// Prior-art pointer: (1) fuzzy name lookup across the Formulary and corpus titles,
// (2) semantic search over the indexed Ayurveda research bibliography.
export default function PriorArt() {
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState(null);
  const [text, setText] = useState("");
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(false);

  const doLookup = async () => {
    if (!name.trim()) return;
    setLookup(await api.lookup(name));
  };

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

  const tone = (s) => (s >= 85 ? "text-leaf" : s >= 65 ? "text-saffron" : "text-danger");

  return (
    <div className="flex flex-col gap-8">
      {/* 1. Name lookup */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg text-leaf">Is this formulation in the classical Formulary?</h3>
        <p className="text-sm text-ink-soft">
          Spelling and transliteration vary (Chyawanprash / Chyavanaprasha / च्यवनप्राश). Type it any way — we normalise
          and show the closest matches with a similarity score, including weak ones, so uncertainty is visible.
        </p>
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)}
                 onKeyDown={(e) => e.key === "Enter" && doLookup()}
                 placeholder="e.g. Chyavanprash, Triphala churna, अश्वगंधा"
                 className="flex-1 bg-paper border border-sage-deep rounded-md px-3 py-2 text-sm focus:border-leaf" />
          <button onClick={doLookup} className="text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper">Look up</button>
        </div>
        {lookup && (
          <div className="bg-paper border border-sage-deep rounded-md divide-y divide-sage-deep">
            {lookup.matches.length === 0 && <p className="p-3 text-sm text-ink-soft">No matches.</p>}
            {lookup.matches.map((m, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {m.name}
                  <span className="ml-2 text-[11px] text-ink-soft">{m.kind === "formulary" ? "Formulary entry" : "Corpus document"}</span>
                </span>
                <span className={`font-semibold ${tone(m.score)}`}>{m.score}% match</span>
              </div>
            ))}
            <p className="px-3 py-2 text-[11px] text-ink-soft">
              Normalised query: <code>{lookup.normalised}</code>. A Formulary match means the formulation is codified
              traditional knowledge (Patents Act s.3(p) applies).
            </p>
          </div>
        )}
      </section>

      {/* 2. Literature search */}
      <section className="flex flex-col gap-3">
        <h3 className="text-lg text-leaf">Published research that may count as prior art</h3>
        <p className="text-sm text-ink-soft">
          Describe your formulation or ingredient. We'll show published research from the indexed bibliography and
          point you to TKDL for the classical record.
        </p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
                  placeholder="e.g. Standardised Tinospora cordifolia (Guduchi) extract for blood-sugar control"
                  className="w-full bg-paper border border-sage-deep rounded-md p-3 text-sm focus:border-leaf" />
        <div className="flex items-center gap-3">
          <button onClick={search} disabled={loading}
                  className="text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40">
            {loading ? "Searching…" : "Find prior art"}
          </button>
          <a href="https://tkdl.res.in" target="_blank" rel="noreferrer" className="text-sm text-leaf underline underline-offset-2">
            Check TKDL
          </a>
        </div>
        {rows && rows.length === 0 && <p className="text-sm text-ink-soft">No matching research found in the indexed bibliography.</p>}
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
      </section>
    </div>
  );
}
