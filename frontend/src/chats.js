// Saved chat threads, kept in the browser so nothing leaves the machine.
const KEY = "ipsakti_chats";

export function loadChats() {
  try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
}

export function saveChats(chats) {
  try { localStorage.setItem(KEY, JSON.stringify(chats.slice(0, 40))); } catch {}
}

export function titleFor(messages) {
  const first = messages.find((m) => m.role === "user");
  const t = (first?.text || "New chat").trim();
  return t.length > 52 ? t.slice(0, 52) + "…" : t;
}

export function when(ts) {
  const d = new Date(ts), now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((now - d) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
