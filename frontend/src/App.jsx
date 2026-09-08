import { useEffect, useRef, useState } from "react";
import { api, token } from "./api.js";
import { loadChats, saveChats } from "./chats.js";
import Sidebar from "./components/Sidebar.jsx";
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
  const [showAuth, setShowAuth] = useState(false);
  const historyRef = useRef([]);

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    if (token.get()) api.me().then(setUser).catch(() => token.clear());
  }, []);

  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setChats((prev) => {
      const next = [{ id: activeId, ts: Date.now(), messages, history: historyRef.current },
                    ...prev.filter((c) => c.id !== activeId)];
      saveChats(next);
      return next;
    });
  }, [messages, activeId]);

  const tabs = user?.role === "facilitator" || user?.role === "admin" ? [...TABS, "Escalations"] : TABS;

  const newChat = () => { setMessages([]); historyRef.current = []; setActiveId(null); setDraft(""); setTab("Ask"); };
  const openChat = (id) => {
    const c = chats.find((x) => x.id === id);
    if (!c) return;
    setMessages(c.messages); historyRef.current = c.history || []; setActiveId(id); setTab("Ask");
  };
  const deleteChat = (id) => {
    setChats((prev) => { const n = prev.filter((c) => c.id !== id); saveChats(n); return n; });
    if (id === activeId) newChat();
  };

  const patch = (id, fields) => setMessages((m) => m.map((x) => (x.id === id ? { ...x, ...fields } : x)));

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
        historyRef.current = [...hist, { role: "user", content: q }, { role: "assistant", content: partial.slice(0, 600) }];
      } else {
        const out = await Promise.all(targets.map((j) => api.chat(q, j, category?.name, lang, hist)));
        patch(holderId, {
          panels: targets.map((j, i) => ({ id: nextId(), jurisdiction: j, question: q, result: out[i] })),
          differences: "",
        });
        historyRef.current = [...hist, { role: "user", content: q },
                              { role: "assistant", content: (out[0].answer_en || out[0].answer || "").slice(0, 600) }];
        api.compare(q, out[0].answer_en || out[0].answer, out[1].answer_en || out[1].answer)
           .then((r) => patch(holderId, { differences: r.differences })).catch(() => {});
      }
    } catch {
      patch(holderId, { loading: false, error: true });
    } finally {
      setLoading(false);
    }
  };

  const lastAnswer = [...messages].reverse().find((m) => m.role === "assistant" && (m.result || m.panels));

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <Sidebar
        chats={chats} activeId={activeId} onOpen={openChat} onNew={newChat} onDelete={deleteChat}
        user={user} onSignIn={() => setShowAuth(true)} onSignOut={() => { token.clear(); setUser(null); }}
        corpusCount={health?.chunks_in_corpus} backendUp={health?.status === "ok"}
      />

      <div className="flex-1 min-w-0 flex flex-col md:h-screen">
        <nav className="border-b border-patra-deep bg-paper/60 backdrop-blur">
          <div className="px-5 flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                      className={`px-3 py-3 text-[13.5px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        tab === t ? "border-tulsi text-tulsi font-semibold" : "border-transparent text-ink-soft hover:text-ink"
                      }`}>
                {t}
              </button>
            ))}
          </div>
        </nav>

        {showAuth ? (
          <main className="flex-1 flex items-center justify-center px-5 py-10">
            <Auth onAuth={(u) => { setUser(u); setShowAuth(false); }} onSkip={() => setShowAuth(false)} />
          </main>
        ) : tab === "Ask" ? (
          <>
            <div className="flex-1 overflow-y-auto scroll-quiet">
              <div className="max-w-3xl mx-auto px-6">
                <Thread messages={messages} onStarter={send} corpusCount={health?.chunks_in_corpus} />
                {lastAnswer && !loading && (
                  <div className="flex justify-end pb-3">
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
          </>
        ) : (
          <main className="flex-1 overflow-y-auto scroll-quiet">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {tab === "Review document" && <Review user={user} />}
              {tab === "Classify product" && <Classify onDone={setCategory} />}
              {tab === "ABS check" && <AbsCheck />}
              {tab === "Fee estimate" && <Fees />}
              {tab === "Prior art" && <PriorArt />}
              {tab === "Corpus" && <Sources />}
              {tab === "Escalations" && <Escalations />}
            </div>
          </main>
        )}
      </div>
    </div>
  );
}
