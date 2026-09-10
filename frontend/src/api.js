// All calls to the FastAPI backend live here. Token is kept in localStorage.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";
const TOKEN_KEY = "ipsakti_token";

export const token = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

function headers() {
  const h = { "Content-Type": "application/json" };
  const t = token.get();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
}

async function handle(res, path) {
  if (!res.ok) {
    let msg = `${path} failed (${res.status})`;
    try { msg = (await res.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const post = (path, body) =>
  fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) }).then((r) => handle(r, path));

const get = (path) => fetch(`${BASE}${path}`, { headers: headers() }).then((r) => handle(r, path));

export const api = {
  health: () => get("/health"),
  chat: (query, jurisdiction, category, lang = "auto", history = [], memory = "") =>
    post("/chat", { query, jurisdiction, category, lang, history, memory }),

  // Streaming version: onEvent(name, payload) is called for "stage", "delta" and "done".
  chatStream: async (query, jurisdiction, category, lang, history, memory, onEvent) => {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ query, jurisdiction, category, lang, history, memory }),
    });
    if (!res.ok || !res.body) throw new Error(`chat failed (${res.status})`);
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const blocks = buf.split("\n\n");
      buf = blocks.pop();
      for (const b of blocks) {
        const ev = b.match(/^event: (.+)$/m)?.[1];
        const data = b.match(/^data: ([\s\S]+)$/m)?.[1];
        if (ev && data) onEvent(ev, JSON.parse(data));
      }
    }
  },
  classifyQuestions: () => get("/classify/questions"),
  classify: (answers) => post("/classify", { answers }),
  absQuestions: () => get("/abs/questions"),
  absCheck: (answers) => post("/abs", { answers }),
  priorArt: (text) => post("/prior-art", { text, k: 8 }),
  sources: () => get("/sources"),
  escalate: (query, reason) => post("/escalate", { query, reason }),
  escalations: () => get("/escalations"),
  fees: (form) => post("/fees", form),
  lookup: (name) => post("/lookup", { name, k: 8 }),
  compare: (question, india, international) => post("/compare", { question, india, international }),
  review: (file, jurisdiction) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("jurisdiction", jurisdiction);
    const h = {};
    const t = token.get();
    if (t) h.Authorization = `Bearer ${t}`;
    return fetch(`${BASE}/review`, { method: "POST", headers: h, body: fd }).then((r) => handle(r, "/review"));
  },
  // auth
  register: (email, password, name, role) => post("/auth/register", { email, password, name, role }),
  login: (email, password) => post("/auth/login", { email, password }),
  me: () => get("/auth/me"),
};
