import { useEffect, useRef, useState } from "react";
import { api, token } from "./api.js";
import { loadChats, saveChats } from "./chats.js";
import Thread from "./components/Thread.jsx";
import Composer from "./components/Composer.jsx";
import ChatList from "./components/ChatList.jsx";
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
const nextId = () => Math.random().toString(36).slice(2, 10);

export default function App() {
  const [tab, setTab] = useState("Ask");
  const [jurisdiction, setJurisdiction] = useState("India");
  const [lang, setLang] = useState("auto");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState(() => loadChats());
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState(null);
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [authState, setAuthState] = useState("checking");
  const historyRef = useRef([]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    if (token.get()) {
      api.me().then((u) => { setUser(u); setAuthState("ready"); })
              .catch(() => { token.clear(); setAuthState("login"); });
    } else setAuthState("login");
  }, []);

  // Persist the open thread whenever it changes.
  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setChats((prev) => {
      const rest = prev.filter((c) => c.id !== activeId);
      const next = [{ id: activeId, ts: Date.now(), messages, history: historyRef.current }, ...rest];
      saveChats(next);
      return next;
    });
  }, [messages, activeId]);

  const signOut = () => { token.clear(); setUser(null); setAuthState("login"); };
  const tabs = user?.role === "facilitator" || user?.role === "admin" ? [...TABS, "Escalations"] : TABS;

  const newChat = () => {
    setMessages([]);
    historyRef.current = [];
    setActiveId(null);
    setDraft("");
    setTab("Ask");
  };

  const openChat = (id) => {
    const c = chats.find((x) => x.id === id);
    if (!c) return;
    setMessages(c.messages);
    historyRef.current = c.history || [];
    setActiveId(id);
    setTab("Ask");
  };

  const deleteChat = (id) => {
    setChats((prev) => { const n = prev.filter((c) => c.id !== id); saveChats(n); return n; });
    if (id === activeId) newChat();
  };

  const patch = (id, fields) =>
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...fields } : x)));

  const send = async (text = draft) => {
    const q = text.trim();
    if (!q || loading) return;
    if (!activeId) setActiveId(nextId());
    setDraft("");
    setLoading(true);

    const targets = jurisdiction === "Both" ? ["India", "International"] : [jurisdiction];
    const holderId = nextId();
    const holder = targets.length === 2
      ? { id: holderId, role: "assistant", question: q, panels: targets.map((j) => ({ id: nextId(), loading: true, jurisdiction: j, question: q })) }
      : { id: holderId, role: "assistant", loading: true, question: q, jurisdiction: targets[0] };
    setMessages((m) => [...m, { id: nextId(), role: "user", text: q }, holder]);

    const hist = historyRef.current.slice(-6);
    try {
      if (targets.length === 1) {
        let partial = "";
        await api.chatStream(q, targets[0], category?.name, lang, hist, (ev, data) => {
          if (ev === "stage") patch(holderId, { stage: data.message });
          else if (ev === "delta") { partial += data.text; patch(holderId, { partial }); }
          else if (ev === "done") patch(holderId, { loading: false, partial: undefined, stage: undefined, result: data });
        });
        const last = (partial || "").slice(0, 600);
        historyRef.current = [...hist, { role: "user", content: q }, { role: "assistant", content: last }];
      } else {
        const out = await Promise.all(targets.map((j) => api.chat(q, j, category?.name, lang, hist)));
        patch(holderId, {
          panels: targets.map((j, i) => ({ id: nextId(), jurisdiction: j, question: q, result: out[i] })),
          differences: "",
        });
        historyRef.current = [...hist, { role: "user", content: q },
                              { role: "assistant", content: (out[0].answer_en || out[0].answer || "").slice(0, 600) }];
        api.compare(q, out[0].answer_en || out[0].answer, out[1].answer_en || out[1].answer)
           .then((r) => patch(holderId, { differences: r.differences }))
           .catch(() => {});
      }
    } catch {
      patch(holderId, { loading: false, error: true });
    } finally {
      setLoading(false);
    }
  };

  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant" && (m.result || m.panels));

  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-patra-deep bg-paper/70">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-3">
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
            <div className="max-w-6xl mx-auto px-5 flex items-center gap-1 overflow-x-auto">
              {tabs.map((t) => (
                <button key={t} onClick={() => setTab(t)}
                        className={`px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px ${
                          tab === t ? "border-tulsi text-tulsi font-semibold" : "border-transparent text-ink-soft hover:text-ink"
                        }`}>
                  {t}
                </button>
              ))}
            </div>
          </nav>

          {tab === "Ask" ? (
            <div className="flex-1 flex flex-col">
              <div className="flex-1 max-w-6xl w-full mx-auto px-5 pt-4 flex flex-col md:flex-row gap-5">
                <ChatList chats={chats} activeId={activeId} onOpen={openChat} onNew={newChat} onDelete={deleteChat} />
                <div className="flex-1 min-w-0">
                  <Thread messages={messages} onStarter={send} corpusCount={health?.chunks_in_corpus} />
                  {lastAnswer && !loading && (
                    <div className="flex justify-end pb-2">
                      <button
                        onClick={() => exportQA({
                          question: lastAnswer.question,
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
                </div>
              </div>
              <Composer
                value={draft} onChange={setDraft} onSend={() => send()} loading={loading}
                jurisdiction={jurisdiction} setJurisdiction={setJurisdiction}
                lang={lang} setLang={setLang} category={category}
              />
            </div>
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
        <div className="max-w-6xl mx-auto px-5 py-2.5 text-[11px] text-ink-soft flex justify-between">
          <span>Ministry of Ayush · All India Institute of Ayurveda</span>
          <span>SIH 2026 · SIH26045</span>
        </div>
      </footer>
    </div>
  );
}
