import { useEffect, useState } from "react";
import { api, token } from "./api.js";
import AnswerPanel from "./components/AnswerPanel.jsx";
import Classify from "./components/Classify.jsx";
import PriorArt from "./components/PriorArt.jsx";
import AbsCheck from "./components/AbsCheck.jsx";
import Sources from "./components/Sources.jsx";
import Segmented from "./components/Segmented.jsx";
import VoiceButton from "./components/VoiceButton.jsx";
import Auth from "./components/Auth.jsx";
import Escalations from "./components/Escalations.jsx";
import Review from "./components/Review.jsx";
import { exportQA } from "./report.js";

const JURISDICTIONS = ["India", "International", "Both"];
const TABS = ["Ask", "Review document", "Classify product", "ABS check", "Prior art", "Corpus"];
const LANGS = [
  ["auto", "Auto-detect"], ["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"], ["ta", "தமிழ்"],
  ["te", "తెలుగు"], ["kn", "ಕನ್ನಡ"], ["ml", "മലയാളം"], ["bn", "বাংলা"], ["gu", "ગુજરાતી"],
];

const EXAMPLES = [
  "Can a classical Ayurvedic formulation be patented in India?",
  "Do I need NBA approval to use an Indian medicinal plant commercially?",
  "Can I advertise my Ayurvedic product as a cure for diabetes?",
  "How do I file one patent application covering many countries?",
];

export default function App() {
  const [tab, setTab] = useState(TABS[0]);
  const [jurisdiction, setJurisdiction] = useState("India");
  const [lang, setLang] = useState("auto");
  const [query, setQuery] = useState("");
  const [asked, setAsked] = useState("");
  const [category, setCategory] = useState(null);
  const [results, setResults] = useState({});   // { India: {...}, International: {...} }
  const [history, setHistory] = useState([]);   // [{query, jurisdiction, results}]
  const [differences, setDifferences] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);           // logged-in user or null
  const [authState, setAuthState] = useState("checking"); // checking | login | ready

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    if (token.get()) {
      api.me().then((u) => { setUser(u); setAuthState("ready"); })
              .catch(() => { token.clear(); setAuthState("login"); });
    } else {
      setAuthState("login");
    }
  }, []);

  const signOut = () => { token.clear(); setUser(null); setAuthState("login"); };
  const tabs = user?.role === "facilitator" || user?.role === "admin" ? [...TABS, "Escalations"] : TABS;

  const ask = async (q = query) => {
    if (!q.trim()) return;
    // push the previous answer into history before asking a new one
    if (asked && Object.keys(results).length) {
      setHistory((h) => [{ query: asked, jurisdiction, results }, ...h]);
    }
    setAsked(q);
    setLoading(true);
    setError(false);
    setResults({});
    setDifferences("");
    const targets = jurisdiction === "Both" ? ["India", "International"] : [jurisdiction];
    try {
      const out = await Promise.all(targets.map((j) => api.chat(q, j, category?.name, lang)));
      const next = {};
      targets.forEach((j, i) => (next[j] = out[i]));
      setResults(next);
      if (targets.length === 2) {
        api.compare(q, next.India.answer_en || next.India.answer, next.International.answer_en || next.International.answer)
           .then((r) => setDifferences(r.differences)).catch(() => {});
      }
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
            <div className="mt-1">
              {user ? (
                <>
                  <span className="text-ink font-semibold">{user.name}</span>
                  <span> · {user.role}</span>
                  <button onClick={signOut} className="ml-2 underline underline-offset-2">Sign out</button>
                </>
              ) : authState === "ready" ? (
                <button onClick={() => setAuthState("login")} className="underline underline-offset-2">Sign in</button>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {authState === "checking" && (
        <main className="flex-1 flex items-center justify-center text-sm text-ink-soft">Loading…</main>
      )}

      {authState === "login" && (
        <main className="flex-1 flex items-center justify-center px-5 py-10">
          <Auth onAuth={(u) => { setUser(u); setAuthState("ready"); }} onSkip={() => setAuthState("ready")} />
        </main>
      )}

      {authState === "ready" && (
      <main className="max-w-6xl w-full mx-auto px-5 py-6 flex-1 flex flex-col gap-6">
        {/* Tabs */}
        <nav className="flex gap-1 border-b border-sage-deep">
          {tabs.map((t) => (
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
              <Segmented options={JURISDICTIONS} value={jurisdiction} onChange={setJurisdiction} />
              {jurisdiction === "Both" && (
                <span className="text-xs text-ink-soft">Indian and international answers are shown separately.</span>
              )}
              <label className="ml-auto flex items-center gap-2 text-sm text-ink-soft">
                Language
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="bg-paper border border-sage-deep rounded-md px-2 py-1 text-sm text-ink"
                >
                  {LANGS.map(([code, name]) => (
                    <option key={code} value={code}>{name}</option>
                  ))}
                </select>
              </label>
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
                <div className="flex items-center gap-2">
                  <VoiceButton lang={lang} onResult={(t) => { setQuery(t); ask(t); }} />
                  <button
                    onClick={() => ask()}
                    disabled={loading || !query.trim()}
                    className="shrink-0 text-sm font-semibold px-5 py-2 rounded-md bg-leaf text-paper disabled:opacity-40"
                  >
                    {loading ? "Searching…" : "Get answer"}
                  </button>
                </div>
              </div>
            </div>

            {/* Answers */}
            {(asked || loading) && (
              <>
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

                {panels.length === 2 && Object.keys(results).length === 2 && (
                  <section className="border-l-4 border-saffron bg-paper rounded-r-md p-4">
                    <h3 className="text-lg text-leaf">Key differences</h3>
                    <p className="text-sm whitespace-pre-wrap mt-1">
                      {differences || "Comparing the two answers…"}
                    </p>
                  </section>
                )}

                {Object.keys(results).length > 0 && !loading && (
                  <div className="flex justify-end">
                    <button
                      onClick={() => exportQA({ question: asked, results, user, differences })}
                      className="text-xs font-semibold px-3 py-1.5 rounded-md border border-leaf text-leaf hover:bg-leaf hover:text-paper"
                    >
                      Download report (PDF)
                    </button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {tab === "Review document" && <Review user={user} />}

        {tab === "Classify product" && <Classify onDone={setCategory} />}
        {tab === "ABS check" && <AbsCheck />}
        {tab === "Prior art" && <PriorArt />}
        {tab === "Corpus" && <Sources />}
        {tab === "Escalations" && <Escalations />}

        {/* Earlier questions in this session */}
        {tab === "Ask" && history.length > 0 && (
          <div className="flex flex-col gap-3 mt-4">
            <h2 className="text-lg text-ink-soft">Earlier in this session</h2>
            {history.map((h, i) => (
              <details key={i} className="bg-paper/50 border border-sage-deep rounded-lg p-3">
                <summary className="cursor-pointer text-sm font-semibold">
                  {h.query} <span className="text-ink-soft font-normal">· {h.jurisdiction}</span>
                </summary>
                <div className={`grid gap-4 mt-3 ${Object.keys(h.results).length === 2 ? "md:grid-cols-2" : ""}`}>
                  {Object.entries(h.results).map(([j, r]) => (
                    <AnswerPanel
                      key={j}
                      title={j === "India" ? "Under Indian law" : "Under international regimes"}
                      result={r}
                      query={h.query}
                    />
                  ))}
                </div>
              </details>
            ))}
          </div>
        )}
      </main>
      )}

      <footer className="border-t border-sage-deep">
        <div className="max-w-6xl mx-auto px-5 py-3 text-[11px] text-ink-soft flex justify-between">
          <span>Ministry of Ayush · All India Institute of Ayurveda · SIH 2026 · SIH26045</span>
          <span>Information, not legal advice.</span>
        </div>
      </footer>
    </div>
  );
}
