#!/bin/bash
# Start backend + frontend together. Ctrl+C stops both.
# Usage: ./run.sh
cd "$(dirname "$0")"

if [ ! -f backend/.env ]; then
  echo "backend/.env missing. Copy backend/.env.example to backend/.env and add your keys."
  exit 1
fi

echo "Starting backend on http://localhost:8000 ..."
(cd backend && source venv/bin/activate && uvicorn main:app --port 8000) &
BACK=$!

echo "Starting frontend on http://localhost:5173 ..."
(cd frontend && npm run dev) &
FRONT=$!

trap "kill $BACK $FRONT 2>/dev/null" EXIT
sleep 3
echo ""
echo "Open http://localhost:5173  (Ctrl+C to stop)"
wait
