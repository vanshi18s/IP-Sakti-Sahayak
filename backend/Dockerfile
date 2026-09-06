FROM python:3.11-slim

WORKDIR /app/backend

# system deps for pypdf / chromadb / torch cpu
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt .
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r requirements.txt

COPY backend/ .
# data folder is mounted as a volume at runtime (see docker-compose.yml)

ENV CHROMA_DIR=/app/data/chroma_db
ENV RAW_DIR=/app/data/raw
ENV HF_HOME=/app/hf_cache

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
