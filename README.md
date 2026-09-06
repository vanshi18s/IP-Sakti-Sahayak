# IP-SAKTI Sahayak

AI assistant for Intellectual Property and regulatory guidance in Ayurveda. Every answer is cited to the law it came from.
Smart India Hackathon 2026 · Problem Statement 26045 · Ministry of Ayush / AIIA

## Run it

Step-by-step guides: **[Mac](SETUP-MAC.md)** · **[Windows](SETUP-WINDOWS.md)**

Short version:

```
git clone https://github.com/vanshi18s/IP-Sakti-Sahayak.git && cd IP-Sakti-Sahayak
cd backend && python3 -m venv venv && source venv/bin/activate && pip install -r requirements-lite.txt
cp -n .env.example .env      # then put your GROQ_API_KEY and JINA_API_KEY in backend/.env
python ingest.py             # builds the knowledge base, ~5 min once
cd ../frontend && npm install && cd ..
./run.sh                     # opens on http://localhost:5173
```

Both keys are free: [Groq](https://console.groq.com) (LLM) · [Jina](https://jina.ai/embeddings) (embeddings).

## Add documents

Put a `.md` file in `markdown_output/` (any subfolder). Filename becomes the document name, e.g. `The_Patents_Act_1970.md`.
Push to `main`. Everyone else: `git pull` then `python ingest.py` — only new files are embedded.

Still needed: Drugs & Cosmetics Act + Rules, Drugs & Magic Remedies Act, FSSAI Ayurveda Aahar, Biological Diversity Act + Rules 2024, PCT, TRIPS, WIPO GRATK 2024, Nagoya, EU 2004/24/EC, FDA botanical guidance.

## What's inside

| Tab | Does |
|---|---|
| Ask | question in any Indian language → cited answer, confidence, India / International / Both |
| Review document | upload a product sheet → patent, regulatory, ABS and advertising checks |
| Classify product | classical / proprietary / new drug / Aahar / cosmetic |
| ABS check | NBA / State Board requirement and benefit sharing |
| Prior art | matching research papers for a formulation |
| Corpus | documents in the knowledge base |

`backend/` FastAPI + RAG (retrieve → grade → answer → verify citations) · `frontend/` React · `markdown_output/` documents · `docs/` report

## Troubleshooting

| Problem | Fix |
|---|---|
| "Backend offline" or "Could not reach the backend" | look at the terminal running `run.sh`; usually a wrong key in `backend/.env` |
| Groq `401` | new key from console.groq.com |
| Jina `401` | new key from jina.ai/embeddings · `429` is normal, it retries |
| Port 8000 in use | `lsof -ti:8000 \| xargs kill` |
