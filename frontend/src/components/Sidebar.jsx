import { titleFor, when } from "../chats.js";
import LeafWatermarks from "./LeafWatermarks.jsx";

// Dark rail: brand, saved threads, then New chat and account at the foot.
export default function Sidebar({ chats, activeId, onOpen, onNew, onDelete, user, onSignIn, onSignOut, corpusCount, backendUp }) {
  return (
    <aside className="relative w-full md:w-64 shrink-0 bg-[#237247] text-mist flex md:flex-col md:h-screen md:sticky md:top-0 overflow-hidden">
      <LeafWatermarks tone="dark" />
      <div className="relative z-10 px-4 py-4 flex items-center gap-2.5 border-b border-white/10">
        <img src="/leaf.svg" alt="" className="w-6 h-6 brightness-0 invert opacity-90" />
        <div className="min-w-0">
          <div className="font-semibold text-[15px] text-white leading-none">IP-SAKTI Sahayak</div>
          <div className="text-[10.5px] text-mist/60 mt-1 truncate">
            {backendUp ? `${corpusCount?.toLocaleString("en-IN")} passages indexed` : "Backend offline"}
          </div>
        </div>
      </div>

      <div className="relative z-10 hidden md:block flex-1 overflow-y-auto scroll-quiet px-2 py-3">
        {chats.length > 0 && (
          <ol className="flex flex-col gap-0.5">
            {chats.map((c) => (
              <li key={c.id} className="group relative">
                <button
                  onClick={() => onOpen(c.id)}
                  className={`w-full text-left rounded-lg px-2.5 py-2 pr-7 transition-colors ${
                    c.id === activeId ? "bg-white/12 text-white" : "hover:bg-white/6 text-mist/85"
                  }`}
                >
                  <div className="text-[13px] leading-snug line-clamp-2">{titleFor(c.messages)}</div>
                  <div className="text-[10px] text-mist/45 mt-0.5">{when(c.ts)}</div>
                </button>
                <button
                  onClick={() => onDelete(c.id)}
                  aria-label="Delete thread"
                  className="absolute right-1.5 top-2 opacity-0 group-hover:opacity-100 text-mist/60 hover:text-copper px-1"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="relative z-10 ml-auto md:ml-0 flex md:flex-col items-center md:items-stretch gap-2 px-3 py-3 md:border-t border-white/10">
        <button
          onClick={onNew}
          className="flex items-center justify-center gap-1.5 text-sm font-semibold text-bark bg-mist rounded-lg px-3 py-2 hover:bg-white"
        >
          <span className="text-base leading-none">+</span> New chat
        </button>
        <div className="text-[11px] text-mist/60 md:pt-1 whitespace-nowrap">
          {user ? (
            <>
              <span className="text-mist">{user.name}</span>
              <button onClick={onSignOut} className="ml-2 underline underline-offset-2 hover:text-white">Sign out</button>
            </>
          ) : (
            <button onClick={onSignIn} className="underline underline-offset-2 hover:text-white">Sign in</button>
          )}
        </div>
      </div>
    </aside>
  );
}
