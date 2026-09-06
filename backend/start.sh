#!/bin/sh
# Container entrypoint: build the vector DB if it is empty, then start the API.
set -e
cd /app/backend

if [ ! -d "/app/data/chroma_db" ] || [ -z "$(ls -A /app/data/chroma_db 2>/dev/null)" ]; then
  echo "No vector DB found - ingesting PDFs from /app/data/raw ..."
  python ingest.py || echo "Ingest failed or no PDFs; API will start with an empty corpus."
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
