import { useEffect, useRef, useState } from "react";
import { api, token } from "./api.js";
import Thread from "./components/Thread.jsx";
import Composer from "./components/Composer.jsx";
import Classify from "./components/Classify.jsx";
import PriorArt from "./components/PriorArt.jsx";
import AbsCheck from "./components/AbsCheck.jsx";
import Sources from "./components/Sources.jsx";
import Auth from "./components/Auth.jsx";
import Escalations from "./components/Escalations.jsx";
import Review from "./components/Review.jsx";
import Fees from "./components/Fees.jsx";
import { exportQA } from "./report.js";

const TABS = ["Ask", "Review document", "Classify product", "ABS check", "Fee estimate", "Prior art", "Corpus"];
let seq = 0;
const nextId = () => `m${++seq}`;

export default function App() {
  const [tab, setTab] = useState("Ask");
  const [jurisdiction, setJurisdiction] = useState("India");
  const [lang, setLang] = useState("auto");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(null);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const historyRef = useRef([]);          // [{role, content}] sent to the backend

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    if (token.get()) {
      api.me().then((u) => { setUser(u); setAuthState("ready"); })
              .catch(() => { token.clear(); setAuthState("login"); });
    } else setAuthState("login");
  }, []);

  const signOut = () => { token.clear(); setUser(null); setAuthState("login"); };
  const tabs = user?.role === "facilitator" || user?.role === "admin" ? [...TABS, "Escalations"] : TABS;

  const newChat = () => {
    setMessages([]);
    historyRef.current = [];
    setDraft("");
  };

  const send = async (text = draft) => {
    const q = text.trim();
    if (!q || loading) return;
    setDraft("");
    setLoading(true);

    const userMsg = { id: nextId(), role: "user", text: q };
    const targets = jurisdiction === "Both" ? ["India", "International"] : [jurisdiction];
    const placeholder = targets.length === 2
      ? { id: nextId(), role: "assistant", panels: targets.map((j) => ({ id: nextId(), loading: true, jurisdiction: j })) }
      : { id: nextId(), role: "assistant", loading: true, question: q };
    setMessages((m) => [...m, userMsg, placeholder]);

    const hist = historyRef.current.slice(-6);
    try {
      const out = await Promise.all(targets.map((j) => api.chat(q, j, category?.name, lang, hist)));
      const filled = targets.length === 2
        ? {
            ...placeholder,
            panels: targets.map((j, i) => ({ id: nextId(), jurisdiction: j, question: q, result: out[i] })),
            differences: "",
          }
        : { ...placeholder, loading: false, jurisdiction: targets[0], question: q, result: out[0] };
      setMessages((m) => m.map((x) => (x.id === placeholder.id ? filled : x)));

      historyRef.current = [...hist,
        { role: "user", content: q },
        { role: "assistant", content: (out[0].answer_en || out[0].answer || "").slice(0, 600) }];

      if (targets.length === 2) {
        api.compare(q, out[0].answer_en || out[0].answer, out[1].answer_en || out[1].answer)
           .then((r) => setMessages((m) => m.map((x) => (x.id === placeholder.id ? { ...x, differences: r.differences } : x))))
           .catch(() => {});
      }
    } catch {
      setMessages((m) => m.map((x) => (x.id === placeholder.id ? { ...x, loading: false, error: true } : x)));
    } finally {
      setLoading(false);
    }
  };

  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant" && (m.result || m.panels));

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-patra-deep bg-paper/70">
        <div className="max-w-4xl mx-auto px-5 py-3 flex items-center gap-3">
          <img src="/leaf.svg" alt="" className="w-6 h-6" />
          <div className="flex-1">
            <h1 className="text-xl text-tulsi leading-none">IP-SAKTI Sahayak</h1>
            <p className="text-[11px] text-ink-soft mt-0.5">
              Intellectual property and regulation for Ayurveda, answered from the statutes
            </p>
          </div>
          <div className="text-[11px] text-ink-soft text-right">
            <div>{health?.status === "ok" ? `${health.chunks_in_corpus.toLocaleString("en-IN")} passages indexed` : "Backend offline"}</div>
            <div className="mt-0.5">
              {user ? (
                <>
                  <span className="text-ink font-semibold">{user.name}</span>
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
        <>
          <nav className="border-b border-patra-deep bg-paper/40">
            <div className="max-w-4xl mx-auto px-5 flex items-center gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                        className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${
                          tab === t ? "border-tulsi text-tulsi font-semibold" : "border-transparent text-ink-soft hover:text-ink"
                        }`}>
                  {t}
                </button>
              ))}
              {tab === "Ask" && messages.length > 0 && (
                <button onClick={newChat}
                        className="ml-auto text-xs text-ink-soft hover:text-tulsi underline underline-offset-2 whitespace-nowrap">
                  New chat
                </button>
              )}
            </div>
          </nav>

          {tab === "Ask" ? (
            <>
              <main className="flex-1 max-w-4xl w-full mx-auto px-5">
                <Thread messages={messages} onStarter={send} corpusCount={health?.chunks_in_corpus} />
                {lastAnswer && !loading && (
                  <div className="flex justify-end pb-2">
                    <button
                      onClick={() => exportQA({
                        question: lastAnswer.question || lastAnswer.panels?.[0]?.question,
                        results: lastAnswer.panels
                          ? Object.fromEntries(lastAnswer.panels.map((p) => [p.jurisdiction, p.result]))
                          : { [lastAnswer.jurisdiction]: lastAnswer.result },
                        user, differences: lastAnswer.differences,
                      })}
                      className="text-xs text-ink-soft underline underline-offset-2 hover:text-tulsi">
                      Save this answer as PDF
                    </button>
                  </div>
                )}
              </main>
              <Composer
                value={draft} onChange={setDraft} onSend={() => send()} loading={loading}
                jurisdiction={jurisdiction} setJurisdiction={setJurisdiction}
                lang={lang} setLang={setLang} category={category}
              />
            </>
          ) : (
            <main className="flex-1 max-w-4xl w-full mx-auto px-5 py-7">
              {tab === "Review document" && <Review user={user} />}
              {tab === "Classify product" && <Classify onDone={setCategory} />}
              {tab === "ABS check" && <AbsCheck />}
              {tab === "Fee estimate" && <Fees />}
              {tab === "Prior art" && <PriorArt />}
              {tab === "Corpus" && <Sources />}
              {tab === "Escalations" && <Escalations />}
            </main>
          )}
        </>
      )}

      <footer className="border-t border-patra-deep">
        <div className="max-w-4xl mx-auto px-5 py-2.5 text-[11px] text-ink-soft flex justify-between">
          <span>Ministry of Ayush · All India Institute of Ayurveda</span>
          <span>SIH 2026 · SIH26045</span>
        </div>
      </footer>
    </div>
  );
}
