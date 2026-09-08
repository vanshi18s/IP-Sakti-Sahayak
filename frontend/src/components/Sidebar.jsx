// Left sidebar: brand, new chat, tools, recent threads, user.
export default function Sidebar({ threads, activeId, onSelect, onNew, onDelete, tool, setTool, tools, user, onSignOut, onSignIn, health }) {
  return (
    <aside className="w-64 shrink-0 h-full flex flex-col bg-leaf text-paper">
      <div className="px-4 pt-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-6 rounded-sm bg-saffron" />
          <h1 className="text-lg text-paper leading-tight">IP-SAKTI Sahayak</h1>
        </div>
        <p className="text-[11px] text-paper/60 mt-1">Cited IP & regulatory guidance for Ayurveda</p>
      </div>

      <div className="px-3 pt-3">
        <button onClick={onNew}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-saffron text-ink font-semibold text-sm hover:brightness-110">
          <span className="text-lg leading-none">+</span> New chat
        </button>
      </div>

      <nav className="px-3 pt-4">
        <div className="text-[10px] uppercase tracking-wider text-paper/50 px-1 mb-1">Tools</div>
        {tools.map((t) => (
          <button key={t} onClick={() => setTool(t)}
                  className={`w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors ${
                    tool === t ? "bg-white/15 text-paper font-semibold" : "text-paper/80 hover:bg-white/10"}`}>
            {t}
          </button>
        ))}
      </nav>

      <div className="px-3 pt-4 flex-1 min-h-0 flex flex-col">
        <div className="text-[10px] uppercase tracking-wider text-paper/50 px-1 mb-1">Recent chats</div>
        <div className="flex-1 overflow-y-auto pr-1">
          {threads.length === 0 && <p className="text-xs text-paper/50 px-1">No chats yet.</p>}
          {threads.map((th) => (
            <div key={th.id}
                 className={`group flex items-center rounded-md ${th.id === activeId && tool === "Chat" ? "bg-white/15" : "hover:bg-white/10"}`}>
              <button onClick={() => onSelect(th.id)} className="flex-1 text-left px-3 py-1.5 text-sm text-paper/90 truncate">
                {th.title || "New chat"}
              </button>
              <button onClick={() => onDelete(th.id)} title="Delete"
                      className="opacity-0 group-hover:opacity-70 hover:!opacity-100 px-2 text-paper/80 text-xs">✕</button>
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-3 border-t border-white/10 text-xs">
        <div className="text-paper/60 mb-1">
          {health?.status === "ok" ? `● Corpus · ${health.chunks_in_corpus} passages` : "○ Backend offline"}
        </div>
        {user ? (
          <div className="flex items-center justify-between">
            <span className="truncate"><span className="font-semibold">{user.name}</span> <span className="text-paper/60">· {user.role}</span></span>
            <button onClick={onSignOut} className="underline underline-offset-2 text-paper/80">Sign out</button>
          </div>
        ) : (
          <button onClick={onSignIn} className="underline underline-offset-2 text-paper/80">Sign in</button>
        )}
      </div>
    </aside>
  );
}
