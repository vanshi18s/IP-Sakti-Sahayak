// All calls to the FastAPI backend live here.
const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function post(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${path} failed (${res.status})`);
  return res.json();
}

export const api = {
  health: () => get("/health"),
  chat: (query, jurisdiction, category, lang = "auto") => post("/chat", { query, jurisdiction, category, lang }),
  classifyQuestions: () => get("/classify/questions"),
  classify: (answers) => post("/classify", { answers }),
  absQuestions: () => get("/abs/questions"),
  absCheck: (answers) => post("/abs", { answers }),
  priorArt: (text) => post("/prior-art", { text, k: 8 }),
  sources: () => get("/sources"),
  escalate: (query, reason) => post("/escalate", { query, reason }),
};
