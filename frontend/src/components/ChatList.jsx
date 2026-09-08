import { titleFor, when } from "../chats.js";

// Saved threads. Collapses to a top strip on narrow screens.
export default function ChatList({ chats, activeId, onOpen, onNew, onDelete }) {
  return (
    <aside className="md:w-60 shrink-0 md:border-r border-patra-deep md:pr-3">
      <button
        onClick={onNew}
        className="w-full text-sm font-semibold text-tulsi border border-tulsi rounded-lg px-3 py-2 hover:bg-tulsi hover:text-patra mb-3"
      >
        New chat
      </button>

      {chats.length === 0 ? (
        <p className="text-[11px] text-ink-soft px-1">Threads you start are kept here on this device.</p>
      ) : (
        <ol className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
          {chats.map((c) => (
            <li key={c.id} className="group relative shrink-0 md:shrink">
              <button
                onClick={() => onOpen(c.id)}
                className={`w-full text-left rounded-lg px-2.5 py-2 pr-7 ${
                  c.id === activeId ? "bg-paper border border-patra-deep" : "hover:bg-paper/60"
                }`}
              >
                <div className="text-[13px] leading-snug line-clamp-2">{titleFor(c.messages)}</div>
                <div className="text-[10px] text-ink-soft mt-0.5">{when(c.ts)}</div>
              </button>
              <button
                onClick={() => onDelete(c.id)}
                aria-label="Delete thread"
                className="absolute right-1.5 top-2 text-ink-soft opacity-0 group-hover:opacity-100 hover:text-copper text-xs px-1"
              >
                ×
              </button>
            </li>
          ))}
        </ol>
      )}
    </aside>
  );
}
