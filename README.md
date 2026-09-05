# IP-SAKTI Sahayak — SIH26045

Multilingual, RAG-based (source-cited) AI assistant for IP and regulatory guidance in Ayurveda.
Ministry of Ayush · All India Institute of Ayurveda · Software · MedTech/HealthTech

## Folder layout
```
SIH/
  backend/        FastAPI + RAG (CRAG grader, citation verifier, classifier, prior-art)
  data/raw/       PDFs + matching .json metadata files (data team drops files here)
  data/chroma_db/ vector DB (auto-created by ingest.py; add to .gitignore)
  data/golden_questions.json   test set for evaluation + demo
  docs/           workflow + research report
  frontend/       React app (to be added)
```

## Run the backend (first time)
```bash
cd backend
python -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env              # then paste your Groq key into .env
```

## Step 1 — put at least one PDF in data/raw
Download the Patents Act 1970 PDF from indiacode.nic.in, save as
`data/raw/patents_act_1970.pdf`. A matching `patents_act_1970.json` is already there.

For every new PDF the data team adds, create a `<same_name>.json` with:
```json
{"doc": "...", "jurisdiction": "India|International", "doc_type": "statute|rules|treaty|guideline|regulation",
 "version_date": "YYYY-MM-DD", "url": "https://..."}
```

## Step 2 — build the vector DB
```bash
python ingest.py            # add --reset to rebuild from scratch
```

## Step 3 — test the RAG from terminal
```bash
python rag.py Can a classical Ayurvedic formulation be patented in India?
```

## Step 4 — start the API
```bash
uvicorn main:app --reload --port 8000
```
Open http://localhost:8000/docs and try:
- `POST /chat`  `{"query": "...", "jurisdiction": "India"}`
- `GET /classify/questions` then `POST /classify` with answers
- `POST /prior-art` `{"text": "Guduchi extract for diabetes"}` (needs the CSV in data/raw)
- `GET /sources`, `POST /escalate`, `GET /health`

## Step 5 — evaluate
```bash
python evaluate.py          # writes backend/eval_results.json
```

## Add to .gitignore
```
backend/venv/
backend/.env
backend/audit_log.jsonl
data/chroma_db/
data/raw/*.pdf
```
