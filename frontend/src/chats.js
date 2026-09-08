// Saved chat threads, kept in this browser and scoped to whoever is signed in.
// Signed-out use has its own "guest" bucket, so signing out never exposes someone else's threads.
const PREFIX = "ipsakti_chats";
const bucket = (owner) => `${PREFIX}:${owner || "guest"}`;

export function loadChats(owner) {
  try { return JSON.parse(localStorage.getItem(bucket(owner))) || []; } catch { return []; }
}

export function saveChats(owner, chats) {
  try { localStorage.setItem(bucket(owner), JSON.stringify(chats.slice(0, 40))); } catch {}
}

export function titleFor(messages) {
  const first = messages.find((m) => m.role === "user");
  const t = (first?.text || "New chat").trim();
  return t.length > 52 ? t.slice(0, 52) + "…" : t;
}

export function when(ts) {
  const d = new Date(ts), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((now - d) / 86400000);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString([], { day: "numeric", month: "short" });
}
