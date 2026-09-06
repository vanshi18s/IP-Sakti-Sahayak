# IP-SAKTI Sahayak — SIH 2026 (SIH26045)

Multilingual, source-cited AI assistant for Intellectual Property and regulatory guidance in Ayurveda.
Ministry of Ayush · All India Institute of Ayurveda · Software · MedTech/HealthTech

Live frontend: https://ip-sakti-sahayak-a854jchfy-prakhar-pandeys-projects-daa6c6b7.vercel.app (backend must be running somewhere — see "Sharing a live link")

---

## Run it on your laptop (first time: ~20 minutes)

You need: Python 3.10+, Node.js 18+, Git.

**1. Clone**
```bash
git clone https://github.com/vanshi18s/IP-Sakti-Sahayak.git
cd IP-Sakti-Sahayak
```

**2. Backend setup**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements-lite.txt
cp .env.example .env
```
Open `backend/.env` and fill in 3 things:
```
GROQ_API_KEY=gsk_...        # free key from https://console.groq.com
JINA_API_KEY=jina_...       # free key from https://jina.ai/embeddings
JWT_SECRET=any-long-random-text
EMBED_BACKEND=jina
```

**3. Frontend setup**
```bash
cd ../frontend
npm install
```

**4. Run (every time)**
```bash
cd ..            # back to repo root
./run.sh
```
Open http://localhost:5173. Header should say "Corpus loaded · 1764 passages". Done.

No model download, no ingestion — the vector database is already in the repo (`data/chroma_db`).

---

## What each tab does

| Tab | What it does | Try |
|---|---|---|
| Ask | Question in any Indian language → cited answer, confidence, sources | "Can a classical Ayurvedic formulation be patented in India?" |
| Review document | Upload a product sheet → 4 checks (patent, regulatory, ABS, advertising) | any .txt describing a formulation |
| Classify product | 3 questions → classical / proprietary / new drug / Aahar / cosmetic | — |
| ABS check | 6 questions → NBA / SBB requirement + benefit sharing | — |
| Prior art | Formulation text → matching research papers | "Guduchi extract for diabetes" |
| Corpus | List of documents in the knowledge base with versions | — |

Toggle India / International / Both. Language dropdown for Hindi, Tamil, etc. Mic button for voice.
Sign in (any email + password) to escalate a question. Register as "IP facilitator" to see the escalation queue.

---

## Adding documents (data team)

1. Convert the PDF to markdown (pymupdf4llm). Put the `.md` file in `markdown_output/` (any subfolder is fine).
2. First line of the file must be the document name: `# The Patents Act, 1970`
3. Optional: add a row in `data/raw/manifest.csv` for link / version date / International:
   `filename,doc,jurisdiction,doc_type,version_date,url`
4. Push to GitHub `main`.
5. Tell Prakhar. He runs `python ingest.py --reset` (2–3 min) and pushes the updated `data/chroma_db`.
6. Everyone else: `git pull`. Done.

Only one person runs ingest (to avoid conflicts). Scanned PDFs give empty `.md` — OCR them first.

**Priority documents still needed:**
- Regulatory: Drugs & Cosmetics Act 1940 + Rules 1945, Drugs & Magic Remedies Act 1954, FSSAI Ayurveda Aahar Regulations 2022, Biological Diversity Act 2002 (2023 amendment) + Rules 2024
- International: PCT, TRIPS, WIPO GRATK Treaty 2024, Nagoya Protocol, EU Directive 2004/24/EC, US FDA Botanical Drug Guidance (mark these `International` in manifest.csv)

---

## Sharing a live link (optional)

The frontend is on Vercel. It needs a backend URL in its `VITE_API_URL` setting. Two ways to provide one:

- **Quick (laptop must stay on):** `cloudflared tunnel --url http://localhost:8000` → paste the printed URL into Vercel → Redeploy.
- **Always on (free):** deploy `render.yaml` on Render.com (Blueprint → connect repo → add the 3 keys). Render sleeps after 15 min idle and wakes in ~50 s.

For the hackathon demo, run everything on a laptop. The link is a bonus.

---

## Folder map

```
backend/     FastAPI + RAG (rag.py = retrieve → grade → answer → verify; classify, abs_check, review, auth, translate)
frontend/    React app (src/App.jsx, src/components/)
data/        chroma_db (vector DB, committed), golden_questions.json (test set), raw/manifest.csv
markdown_output/  documents from the data team
docs/        workflow + research report
run.sh       starts backend + frontend
```

## Troubleshooting

| Problem | Fix |
|---|---|
| "Backend offline" in header | backend not running — check terminal 1 for errors |
| `GROQ_API_KEY missing` | `.env` must be in `backend/` |
| `429 Too Many Requests` from Jina | free-tier rate limit, it retries automatically |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill` then rerun |
| Answer abstains on international question | no international documents yet — expected |
| Windows: `./run.sh` doesn't work | run the two commands from step 4 manually in two terminals |
