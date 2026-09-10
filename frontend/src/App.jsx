import { useEffect, useRef, useState } from "react";
import { api, token } from "./api.js";
import { loadChats, saveChats } from "./chats.js";
import Sidebar from "./components/Sidebar.jsx";
import LeafWatermarks from "./components/LeafWatermarks.jsx";
import Thread from "./components/Thread.jsx";
import Composer from "./components/Composer.jsx";
import PriorArt from "./components/PriorArt.jsx";
import AbsCheck from "./components/AbsCheck.jsx";
import Sources from "./components/Sources.jsx";
import Auth from "./components/Auth.jsx";
import Escalations from "./components/Escalations.jsx";
import Review from "./components/Review.jsx";
import Fees from "./components/Fees.jsx";
import { exportQA } from "./report.js";

const TABS = ["Ask", "Review document", "ABS check", "Fee estimate", "Prior art", "Corpus"];
const nextId = () => Math.random().toString(36).slice(2, 10);

function historyFromMessages(thread) {
  return thread.flatMap((message) => {
    if (message.role === "user") return [{ role: "user", content: message.text }];
    if (message.result) {
      return [{ role: "assistant", content: message.result.answer_en || message.result.answer || "" }];
    }
    const firstPanel = message.panels?.find((panel) => panel.result)?.result;
    if (firstPanel) {
      return [{ role: "assistant", content: firstPanel.answer_en || firstPanel.answer || "" }];
    }
    return [];
  }).filter((turn) => turn.content.trim());
}

export default function App() {
  const [tab, setTab] = useState("Ask");
  const [jurisdiction, setJurisdiction] = useState("India");
  const [lang, setLang] = useState("auto");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [conversationMemory, setConversationMemory] = useState("");
  const [health, setHealth] = useState(null);
  const [user, setUser] = useState(null);
  const [showAuth, setShowAuth] = useState(false);
  const historyRef = useRef([]);
  const owner = user?.email || null;

  useEffect(() => {
    api.health().then(setHealth).catch(() => setHealth({ status: "down" }));
    if (token.get()) api.me().then(setUser).catch(() => token.clear());
  }, []);

  // Threads belong to whoever is signed in; switching account switches the list.
  useEffect(() => {
    setChats(loadChats(owner));
    setMessages([]);
    historyRef.current = [];
    setConversationMemory("");
    setActiveId(null);
  }, [owner]);

  useEffect(() => {
    if (!activeId || messages.length === 0) return;
    setChats((prev) => {
      const next = [{ id: activeId, ts: Date.now(), messages, history: historyRef.current, memory: conversationMemory },
                    ...prev.filter((c) => c.id !== activeId)];
      saveChats(owner, next);
      return next;
    });
  }, [messages, activeId, owner, conversationMemory]);

  const tabs = user?.role === "facilitator" || user?.role === "admin" ? [...TABS, "Escalations"] : TABS;

  const newChat = () => { setMessages([]); historyRef.current = []; setConversationMemory(""); setActiveId(null); setDraft(""); setTab("Ask"); };
  const openChat = (id) => {
    const c = chats.find((x) => x.id === id);
    if (!c) return;
    setMessages(c.messages); historyRef.current = historyFromMessages(c.messages); setConversationMemory(c.memory || ""); setActiveId(id); setTab("Ask");
  };
  const deleteChat = (id) => {
    setChats((prev) => { const n = prev.filter((c) => c.id !== id); saveChats(owner, n); return n; });
    if (id === activeId) newChat();
  };
  const signOut = () => { token.clear(); setUser(null); setShowAuth(false); setTab("Ask"); };

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

    // Rebuild memory from the visible thread. This avoids losing context if an
    // older saved thread contains an incomplete streaming draft.
    const hist = historyFromMessages(messages).slice(-24);
    try {
      if (targets.length === 1) {
        let partial = "";
        let completedResult = null;
        await api.chatStream(q, targets[0], undefined, lang, hist, conversationMemory, (ev, data) => {
          if (ev === "stage") patch(holderId, { stage: data.message });
          else if (ev === "delta") { partial += data.text; patch(holderId, { partial }); }
          else if (ev === "done") {
            completedResult = data;
            setConversationMemory(data.conversation_memory || conversationMemory);
            patch(holderId, { loading: false, partial: undefined, stage: undefined, result: data });
          }
        });
        // Non-English drafts are hidden while translating, so use the completed
        // result (and its internal English original when available) for memory.
        const rememberedAnswer = completedResult?.answer_en || completedResult?.answer || partial;
        historyRef.current = [...hist, { role: "user", content: q }, { role: "assistant", content: rememberedAnswer.slice(0, 1200) }];
      } else {
        const out = await Promise.all(targets.map((j) => api.chat(q, j, undefined, lang, hist, conversationMemory)));
        patch(holderId, {
          panels: targets.map((j, i) => ({ id: nextId(), jurisdiction: j, question: q, result: out[i] })),
          differences: "",
        });
        historyRef.current = [...hist, { role: "user", content: q },
                              { role: "assistant", content: (out[0].answer_en || out[0].answer || "").slice(0, 1200) }];
        setConversationMemory(out[0].conversation_memory || conversationMemory);
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
        user={user} onSignIn={() => setShowAuth(true)} onSignOut={signOut}
        corpusCount={health?.chunks_in_corpus} backendUp={health?.status === "ok"}
      />

      <div className="relative flex-1 min-w-0 flex flex-col md:h-screen">
        <LeafWatermarks />

        <nav className="relative z-10 border-b border-emerald-950/20 bg-gradient-to-r from-[#195b3a] via-[#237247] to-[#1b5a3a] text-white shadow-[0_3px_16px_rgba(20,83,45,0.18)]">
          <div className="px-5 flex items-center gap-1 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                      className={`px-4 py-4 text-[14px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                        tab === t ? "border-[#f5d78f] text-white font-bold" : "border-transparent text-white/75 hover:text-white"
                      }`}>
                {t}
              </button>
            ))}
          </div>
        </nav>

        {showAuth ? (
          <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-10">
            <Auth onAuth={(u) => { setUser(u); setShowAuth(false); }} onSkip={() => setShowAuth(false)} />
          </main>
        ) : tab === "Ask" ? (
          <>
            <div className="relative z-10 flex-1 overflow-y-auto scroll-quiet">
              <div className="max-w-3xl mx-auto px-6 min-h-full flex flex-col">
                <div className="flex-1 flex flex-col">
                  <Thread messages={messages} onStarter={send} />
                </div>
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
            <div className="relative z-10">
              <Composer
                value={draft} onChange={setDraft} onSend={() => send()} loading={loading}
                jurisdiction={jurisdiction} setJurisdiction={setJurisdiction}
                lang={lang} setLang={setLang}
              />
            </div>
          </>
        ) : (
          <main className="relative z-10 flex-1 overflow-y-auto scroll-quiet">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {tab === "Review document" && <Review user={user} />}
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
