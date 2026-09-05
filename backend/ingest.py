"""
Ingest legal PDFs into ChromaDB.

Usage:
    python ingest.py                 # ingest every PDF in data/raw
    python ingest.py --reset         # wipe the DB and re-ingest

How metadata works:
    Each PDF needs a sidecar file with the same name and .json extension
    sitting next to it in data/raw, e.g.
        data/raw/patents_act_1970.pdf
        data/raw/patents_act_1970.json  ->
        {
          "doc": "The Patents Act, 1970",
          "jurisdiction": "India",          # India | International
          "doc_type": "statute",            # statute | rules | treaty | guideline | regulation
          "version_date": "2024-03-15",
          "url": "https://indiacode.nic.in/..."
        }
    If the JSON is missing, sensible defaults are used and a warning is printed.
    Citations come from this metadata + the detected section heading + page number.
"""
import argparse
import json
import re
import shutil
import sys
from pathlib import Path

import chromadb
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

import config

SECTION_RE = re.compile(
    r"^\s*((?:Section|Sec\.|Rule|Article|Art\.|Regulation|Reg\.)\s*\d+[A-Za-z]?(?:\(\w+\))*)",
    re.IGNORECASE,
)


def load_metadata(pdf_path: Path) -> dict:
    meta_path = pdf_path.with_suffix(".json")
    defaults = {
        "doc": pdf_path.stem.replace("_", " ").title(),
        "jurisdiction": "India",
        "doc_type": "statute",
        "version_date": "unknown",
        "url": "",
    }
    if meta_path.exists():
        defaults.update(json.loads(meta_path.read_text(encoding="utf-8")))
    else:
        print(f"  [warn] no metadata json for {pdf_path.name}; using defaults")
    return defaults


def extract_pages(pdf_path: Path):
    reader = PdfReader(str(pdf_path))
    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        if text.strip():
            yield i, text


def chunk_page(text: str, words_per_chunk: int, overlap: int):
    """Split page text into overlapping word windows; track the last seen section heading."""
    words = text.split()
    step = max(words_per_chunk - overlap, 1)
    current_section = ""
    for start in range(0, len(words), step):
        chunk_words = words[start:start + words_per_chunk]
        chunk = " ".join(chunk_words)
        for line in chunk.split("\n"):
            m = SECTION_RE.match(line)
            if m:
                current_section = m.group(1).strip()
        yield chunk, current_section
        if start + words_per_chunk >= len(words):
            break


def build_chunks(pdf_path: Path):
    meta = load_metadata(pdf_path)
    docs, metas, ids = [], [], []
    n = 0
    for page_no, text in extract_pages(pdf_path):
        for chunk, section in chunk_page(text, config.CHUNK_WORDS, config.CHUNK_OVERLAP):
            n += 1
            docs.append(chunk)
            metas.append({
                **meta,
                "section": section or "n/a",
                "page": page_no,
                "source_file": pdf_path.name,
            })
            ids.append(f"{pdf_path.stem}__p{page_no}__c{n}")
    return docs, metas, ids


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete existing DB first")
    args = parser.parse_args()

    if args.reset and config.CHROMA_DIR.exists():
        shutil.rmtree(config.CHROMA_DIR)
        print(f"Deleted {config.CHROMA_DIR}")

    pdfs = sorted(config.RAW_DIR.glob("*.pdf"))
    if not pdfs:
        print(f"No PDFs found in {config.RAW_DIR}. Put at least one PDF there.")
        sys.exit(1)

    print(f"Loading embedding model {config.EMBED_MODEL} (first run downloads ~2GB)...")
    embedder = SentenceTransformer(config.EMBED_MODEL)

    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    collection = client.get_or_create_collection(
        name=config.COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )

    total = 0
    for pdf in pdfs:
        print(f"Processing {pdf.name} ...")
        docs, metas, ids = build_chunks(pdf)
        if not docs:
            print("  [skip] no extractable text (scanned PDF? run OCR first)")
            continue
        # Chroma limit is ~5k per add; batch it
        for i in range(0, len(docs), 256):
            batch_docs = docs[i:i + 256]
            embeds = embedder.encode(batch_docs, normalize_embeddings=True).tolist()
            collection.upsert(
                documents=batch_docs,
                embeddings=embeds,
                metadatas=metas[i:i + 256],
                ids=ids[i:i + 256],
            )
        total += len(docs)
        print(f"  added {len(docs)} chunks")

    print(f"\nDone. Collection '{config.COLLECTION_NAME}' now has {collection.count()} chunks "
          f"({total} added this run). DB at {config.CHROMA_DIR}")


if __name__ == "__main__":
    main()
