import { useEffect, useState } from "react";
import { api } from "./api.js";
import AnswerPanel from "./components/AnswerPanel.jsx";
import Classify from "./components/Classify.jsx";
import PriorArt from "./components/PriorArt.jsx";

const JURISDICTIONS = ["India", "International", "Both"];
const TABS = ["Ask", "Classify product", "Prior art"];

const EXAMPLES = [
  "Can a classical Ayurvedic formulation be patented in India?",
  "Do I need NBA approval to use an Indian medicinal plant commercially?",
  "Can I advertise my Ayurvedic product as a cure for diabetes?",
  "How do I file one patent application covering many countries?",
];

export default function App() {
  const [tab, setTab] = useState(TABS[0]);
  const [jurisdiction, setJurisdiction] = useState("India");
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [category, setCategory] = useState(null);
  const [results, setResults] = useState({});   // { India: {...}, International: {...} }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
  }, []);

  const ask = async (q = query) => {
    if (!q.trim()) return;
    setAsked(q);
    setLoading(true);
    setError(false);
    setResults({});
    const targets = jurisdiction === "Both" ? ["India", "International"] : [jurisdiction];
    try {
      const out = await Promise.all(targets.map((j) => api.chat(q, j, category?.name)));
      const next = {};
      targets.forEach((j, i) => (next[j] = out[i]));
      setResults(next);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const panels = jurisdiction === "Both" ? ["India", "International"] : [jurisdiction];

  return (
    <div className="min-h-full flex flex-col">
      {/* Header */}
      <header className="border-b border-sage-deep bg-paper/60">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl text-leaf leading-tight">IP-SAKTI Sahayak</h1>
            <p className="text-xs text-ink-soft">
              Source-cited guidance on intellectual property and regulation for Ayurveda
            </p>
          </div>
          <div className="text-xs text-ink-soft text-right">
            {health?.status === "ok"
              ? `Corpus loaded · ${health.chunks_in_corpus} passages`
              : "Backend offline"}
            {category && <div className="text-saffron font-semibold mt-0.5">Product: {category.name}</div>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl w-full mx-auto px-5 py-6 flex-1 flex flex-col gap-6">
        {/* Tabs */}
        <nav className="flex gap-1 border-b border-sage-deep">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-semibold -mb-px border-b-2 ${
                tab === t ? "border-leaf text-leaf" : "border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </nav>

        {tab === "Ask" && (
          <>
            {/* Jurisdiction toggle */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm text-ink-soft">Which law applies?</span>
              <div className="inline-flex rounded-md border border-leaf overflow-hidden">
                {JURISDICTIONS.map((j) => (
                  <button
                    key={j}
                    onClick={() => setJurisdiction(j)}
                    className={`px-3 py-1.5 text-sm font-semibold ${
                      jurisdiction === j ? "bg-leaf text-paper" : "bg-paper text-leaf hover:bg-sage"
                    }`}
                  >
                    {j}
                  </button>
                ))}
              </div>
              {jurisdiction === "Both" && (
                <span className="text-xs text-ink-soft">Indian and international answers are shown separately.</span>
              )}
            </div>

            {/* Query box */}
            <div className="flex flex-col gap-2">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    ask();
                  }
                }}
                rows={3}
                placeholder="Ask about patents, trademarks, GI, licensing, ABS, advertising or export rules…"
                className="w-full bg-paper border border-sage-deep rounded-md p-3 text-[15px] focus:border-leaf"
              />
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      onClick={() => {
                        setQuery(ex);
                        ask(ex);
                      }}
                      className="text-xs px-2.5 py-1 rounded-full border border-sage-deep bg-paper text-ink-soft hover:border-leaf hover:text-leaf"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => ask()}
                  disabled={loading || !query.trim()}
                  className="shrink-0 text-sm font-semibold px-5 py-2 rounded-md bg-leaf text-paper disabled:opacity-40"
                >
                  {loading ? "Searching…" : "Get answer"}
                </button>
              </div>
            </div>

            {/* Answers */}
            {(asked || loading) && (
              <div className={`grid gap-4 ${panels.length === 2 ? "md:grid-cols-2" : "grid-cols-1"}`}>
                {panels.map((j) => (
                  <AnswerPanel
                    key={j}
                    title={j === "India" ? "Under Indian law" : "Under international regimes"}
                    result={results[j]}
                    query={asked}
                    loading={loading}
                    error={error}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === "Classify product" && <Classify onDone={setCategory} />}
        {tab === "Prior art" && <PriorArt />}
      </main>

      <footer className="border-t border-sage-deep">
        <div className="max-w-6xl mx-auto px-5 py-3 text-[11px] text-ink-soft flex justify-between">
          <span>Ministry of Ayush · All India Institute of Ayurveda · SIH 2026 · SIH26045</span>
          <span>Information, not legal advice.</span>
        </div>
      </footer>
    </div>
  );
}
