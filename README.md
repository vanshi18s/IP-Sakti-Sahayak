---
title: IP-SAKTI Sahayak API
emoji: 🌿
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# IP-SAKTI Sahayak — SIH 2026 · SIH26045

A multilingual, RAG-based (source-cited) AI assistant for Intellectual Property and regulatory guidance in Ayurveda, across Indian and international regimes.

**Ministry of Ayush · All India Institute of Ayurveda · Software · MedTech/HealthTech**
Idea submission deadline: 30 September 2026

---

## 1. What this project does

A user (Ayurveda manufacturer, researcher, startup, practitioner) asks a question like *"Can a classical Ayurvedic formulation be patented in India?"*. The system:

1. Finds the exact passages in official laws (Patents Act, Drugs & Cosmetics Act, WIPO treaties, etc.) that answer it
2. Writes a plain-language answer **only from those passages**
3. Shows every source it used — Act name, Section, page, link — so nothing is made up
4. Keeps Indian and international law visibly separate
5. Says "I don't know" when the corpus has no answer, and offers to escalate to a human

It also classifies the user's product (classical / proprietary / new drug / Ayurveda-Aahar / cosmetic) and points to prior art for patent checks.

---

## 2. How it works (read this once)

```
Your question
     │
     ▼
Embedding model (bge-m3, runs on your laptop)  →  turns question into a vector
     │
     ▼
ChromaDB (vector database on disk)              →  finds 8 closest passages from the law corpus
     │
     ▼
Grader (LLM via Groq API)                        →  checks each passage: relevant or not? (CRAG step)
     │  none relevant → rewrite question once → retry → still none → ABSTAIN
     ▼
Generator (LLM via Groq API)                     →  writes answer using ONLY the relevant passages, cites [1][2]
     │
     ▼
Citation verifier (plain Python)                 →  every [n] must map to a real passage; confidence score
     │
     ▼
React frontend                                   →  answer + source cards + confidence + escalate button
```

**Two AI models are involved:**
- **bge-m3** — embedding model, downloaded once (~2.3 GB), runs locally, free. Only converts text to numbers.
- **gpt-oss-120b via Groq** — the LLM that reads and writes. Called through an API key. Free tier is enough for development.

No OpenAI needed. Swap the LLM by changing two lines in `.env`.

---

## 3. Folder layout

```
IP-Sakti-Sahayak/
  backend/
    main.py           FastAPI server — all API endpoints
    rag.py            retrieve → grade → generate → verify citations
    ingest.py         PDFs → chunks → ChromaDB  (run this when new documents arrive)
    classify.py       3-question product classification flow
    prior_art.py      search over the research-article CSV
    evaluate.py       runs golden questions, reports metrics
    config.py         settings
    requirements.txt
    .env.example      copy to .env and add your Groq key
  frontend/
    src/App.jsx       main page: tabs, jurisdiction toggle, question box
    src/components/   AnswerPanel, SourceCard, Classify, PriorArt
    src/api.js        all backend calls
  data/
    raw/              PDFs + matching .json metadata  ← DATA TEAM PUTS FILES HERE
    chroma_db/        vector DB (auto-created, not in git)
    golden_questions.json   test set
  docs/               workflow + research report + dataset links
```

---

## 4. Setup — first time

Total time on a normal laptop: **~30 minutes** (most of it is the one-time model download).

### 4.1 Prerequisites
- Python 3.10+ (`python3 --version`)
- Node.js 18+ (`node -v`)
- Git
- A free Groq API key from https://console.groq.com → API Keys → Create

### 4.2 Clone and switch to the working branch
```bash
git clone https://github.com/vanshi18s/IP-Sakti-Sahayak.git
cd IP-Sakti-Sahayak
git checkout prakhar-backend
```

### 4.3 Backend (~20 min, mostly download)
```bash
cd backend
python3 -m venv venv
source venv/bin/activate            # Windows: venv\Scripts\activate
pip install -r requirements.txt     # ~5 min
cp .env.example .env
```
Open `backend/.env` and paste your key:
```
GROQ_API_KEY=gsk_xxxxxxxx
GROQ_MODEL=openai/gpt-oss-120b
```

Put at least one PDF in `data/raw/` (see section 6), then:
```bash
python ingest.py            # first run downloads bge-m3 (~2.3 GB, 5-15 min). Later runs: seconds.
```
You should see `Done. Collection 'legal_corpus' now has N chunks`.

Quick test from the terminal (put the question in quotes):
```bash
python rag.py "Can a classical Ayurvedic formulation be patented in India?"
```

Start the API:
```bash
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs to try endpoints in the browser.

### 4.4 Frontend (~5 min)
Open a **second terminal**:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173. The header should say `Corpus loaded · N passages`. If it says `Backend offline`, the uvicorn terminal isn't running.

---

## 5. Daily workflow (after first setup)

Terminal 1:
```bash
cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
```
Terminal 2:
```bash
cd frontend && npm run dev
```
That's it. Model loads in ~15 s the first time you ask a question.

---

## 6. Adding documents (data team)

Every document = one PDF + one JSON with the **same filename**, both in `data/raw/`:

```
data/raw/patents_act_1970.pdf
data/raw/patents_act_1970.json
```

JSON contents:
```json
{
  "doc": "The Patents Act, 1970",
  "jurisdiction": "India",
  "doc_type": "statute",
  "version_date": "2024-03-15",
  "url": "https://www.indiacode.nic.in/handle/123456789/1392"
}
```
- `jurisdiction`: exactly `India` or `International` (this powers the toggle)
- `doc_type`: `statute` | `rules` | `treaty` | `guideline` | `regulation`
- `url`: the official source page — this becomes the "Open official text" link

Then run `python ingest.py` (or `python ingest.py --reset` to rebuild everything). Commit the `.json` files; PDFs are git-ignored (too large) — share them via Drive.

**Priority list of documents:** see `docs/SIH26045_Workflow_and_Research_Report.md` → Part A.5. Start with India IP, then India regulatory, then international.

Also drop `ayurveda_drug_research_final.csv` in `data/raw/` — the prior-art search indexes it automatically on first use.

---

## 7. API reference

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | status + number of chunks |
| POST | `/chat` | `{query, jurisdiction?, category?}` | answer, sources[], confidence, abstained |
| GET | `/classify/questions` | — | the 3 classification questions |
| POST | `/classify` | `{answers: {q1, q2, q3}}` | product category + IP/regulatory/ABS posture |
| POST | `/prior-art` | `{text, k?}` | matching research articles |
| GET | `/sources` | — | list of documents in the corpus with versions |
| POST | `/escalate` | `{query, reason?}` | logs the query for a human facilitator |

---

## 8. Evaluation

```bash
cd backend && python evaluate.py
```
Runs `data/golden_questions.json` and reports **citation correctness** and **safe abstention rate** — the metrics named in the problem statement. Add more questions to the JSON as documents grow.

---

## 9. Git workflow

- `main` — stable, owned by team lead. Don't push directly.
- `prakhar-backend` — active development branch. Work here.
- When a feature is done and tested: open a Pull Request from `prakhar-backend` → `main`.

Every time you finish something:
```bash
git add .
git commit -m "short description of what changed"
git push
```

Never commit: `.env` (your key), `venv/`, `node_modules/`, `data/chroma_db/`, PDFs. `.gitignore` already handles these.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `zsh: no matches found` when running rag.py | Put the question in double quotes |
| `GROQ_API_KEY missing` | `.env` must be inside `backend/`, not the repo root |
| `model_not_found` from Groq | Model name changed. Set `GROQ_MODEL=openai/gpt-oss-120b` in `.env` |
| `No PDFs found` | Put a PDF in `data/raw/` |
| Frontend says "Backend offline" | Start uvicorn in another terminal on port 8000 |
| Ingest is slow | Only the first run downloads the model. Ctrl+C any extra `model.safetensors` download after "Done" appears |
| Laptop too slow with bge-m3 | In `.env` set `EMBED_MODEL=intfloat/multilingual-e5-small`, then `python ingest.py --reset` |
| Answer abstains on international questions | No international PDFs ingested yet — expected until data team adds them |

---

## 11. Roadmap

- [x] Ingestion pipeline with section-aware chunking and metadata
- [x] RAG with CRAG grader, citation verification, confidence, abstention
- [x] Product classification flow
- [x] Prior-art search over research bibliography
- [x] React frontend with jurisdiction toggle and source cards
- [ ] Ingest full India IP + regulatory corpus
- [ ] Ingest international corpus (PCT, TRIPS, WIPO GRATK, Nagoya, EU 2004/24/EC, FDA)
- [ ] Hindi input/output via Bhashini / IndicTrans2
- [ ] ABS compliance checklist UI
- [ ] Hybrid retrieval (BM25 + vector) and re-ranker
- [ ] Dockerfile + deployment (Hugging Face Spaces for demo)
- [ ] Evaluation report with 30+ golden questions
