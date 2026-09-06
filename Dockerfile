FROM python:3.11-slim

# Hugging Face Spaces runs as uid 1000 and serves on port 7860
RUN useradd -m -u 1000 user
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r /app/backend/requirements.txt

COPY backend/ /app/backend/
COPY data/ /app/data/
RUN chmod +x /app/backend/start.sh && chown -R user:user /app

USER user
ENV HF_HOME=/app/hf_cache \
    CHROMA_DIR=/app/data/chroma_db \
    RAW_DIR=/app/data/raw \
    PORT=7860

# Pre-download the embedding model at build time so first request is fast
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('BAAI/bge-m3')"

EXPOSE 7860
CMD ["/app/backend/start.sh"]
