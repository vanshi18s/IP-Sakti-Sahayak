# Setup on Mac — copy-paste one block at a time

Open **Terminal** (Cmd+Space, type "Terminal").

## Block 1 — check you have the tools
```
python3 --version
node --version
git --version
```
All three must print a version. If one says "command not found":
- Python: https://www.python.org/downloads/ (3.11 or newer)
- Node: https://nodejs.org (LTS)
- Git: run `xcode-select --install`

## Block 2 — get the code
```
cd ~/Desktop
git clone https://github.com/vanshi18s/IP-Sakti-Sahayak.git
cd IP-Sakti-Sahayak
```

## Block 3 — backend
```
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements-lite.txt
cp .env.example .env
open -e .env
```
A text editor opens. Replace the three placeholders:
- `GROQ_API_KEY=` → your key from https://console.groq.com (Sign up → API Keys → Create)
- `JINA_API_KEY=` → your key from https://jina.ai/embeddings (scroll down → "Get API key")
- `JWT_SECRET=` → any random text, e.g. `mysecret12345abcdef`

Save (Cmd+S) and close the editor.

## Block 4 — build the knowledge base (5 minutes, once)
```
python ingest.py --reset
```
Wait until you see `Done. Collection 'legal_corpus' now has ... chunks`.
Lines saying `429, retrying` are normal — it waits and continues.

## Block 5 — frontend
```
cd ../frontend
npm install
cd ..
```

## Block 6 — run (do this every time)
```
cd ~/Desktop/IP-Sakti-Sahayak
./run.sh
```
Wait 20 seconds, open http://localhost:5173 in Chrome.
Header must say **Corpus loaded · N passages**. Press Ctrl+C in Terminal to stop.

## If something breaks
| You see | Do this |
|---|---|
| `permission denied: ./run.sh` | `chmod +x run.sh` then `./run.sh` again |
| `Backend offline` in the header | look at Terminal — the backend line shows the error; usually a wrong key in `.env` |
| `GROQ_API_KEY missing` | `.env` must be inside `backend/`, not the main folder |
| `Address already in use` | `lsof -ti:8000 \| xargs kill` then run again |
| `No documents found` | you are not inside `backend/` — `cd backend` first |
| Jina `401` | key pasted wrong — no spaces, no quotes |

## When new documents are added
```
cd ~/Desktop/IP-Sakti-Sahayak
git pull
cd backend && source venv/bin/activate && python ingest.py --reset
```
