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
    r"^\s*(?:"
    r"(?:Section|Sec\.|Rule|Article|Art\.|Regulation|Reg\.)\s*\d+[A-Za-z]?(?:\(\w+\))*"   # "Section 3(p)"
    r"|\d{1,3}[A-Z]{0,2}\.\s+[A-Z][^.\n]{3,80}"                                        # "3. What are not inventions"
    r")",
)


def _tag_words(text: str):
    """Yield (word, section_label) for every word on the page, tracking the last seen heading."""
    section = ""
    for line in text.split("\n"):
        m = SECTION_RE.match(line)
        if m:
            label = m.group(0).strip()
            num = re.match(r"\s*(\d{1,3}[A-Z]{0,2})\.", label)
            section = f"Section {num.group(1)}" if num else label[:60]
        for w in line.split():
            yield w, section


def _manifest_rows():
    """Optional data/raw/manifest.csv: filename,doc,jurisdiction,doc_type,version_date,url"""
    path = config.RAW_DIR / "manifest.csv"
    if not path.exists():
        return {}
    import csv
    rows = {}
    with open(path, encoding="utf-8-sig") as f:
        for r in csv.DictReader(f):
            name = (r.get("filename") or "").strip()
            if name:
                rows[name] = {k: (v or "").strip() for k, v in r.items() if k != "filename"}
    return rows


def _first_heading(text: str) -> str | None:
    for line in text.splitlines()[:20]:
        m = re.match(r"^\s*#+\s*(.+?)\s*$", line)
        if m:
            return m.group(1).replace("*", "").strip()[:120]
    return None


def load_metadata(src_path: Path, text_head: str = "") -> dict:
    meta_path = src_path.with_suffix(".json")
    defaults = {
        "doc": _first_heading(text_head) or src_path.stem.replace("_", " ").title(),
        "jurisdiction": "India",
        "doc_type": "statute",
        "version_date": "unknown",
        "url": "",
    }
    manifest = _manifest_rows()
    if meta_path.exists():
        defaults.update(json.loads(meta_path.read_text(encoding="utf-8")))
    elif src_path.name in manifest:
        defaults.update({k: v for k, v in manifest[src_path.name].items() if v})
    else:
        print(f"  [info] no manifest row for {src_path.name}; using heading/defaults")
    return defaults


def _clean_md(text: str) -> str:
    text = text.replace("\r\n", "\n")
    text = re.sub(r"^\s{0,3}#{1,6}\s*", "", text, flags=re.M)      # drop heading hashes
    text = text.replace("**", "").replace("__", "")
    text = re.sub(r"^\s*\|?[-:| ]+\|?\s*$", "", text, flags=re.M)   # table separator rows
    text = re.sub(r"\|", " | ", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text


def extract_pages(src_path: Path):
    """Yield (page_no, text). PDFs give real pages; .md/.txt are split into ~1500-word pseudo-pages."""
    if src_path.suffix.lower() == ".pdf":
        reader = PdfReader(str(src_path))
        for i, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            text = re.sub(r"[ \t]+", " ", text)
            text = re.sub(r"\n{3,}", "\n\n", text)
            if text.strip():
                yield i, text
        return
    text = _clean_md(src_path.read_text(encoding="utf-8", errors="ignore"))
    lines, buf, count, page = text.split("\n"), [], 0, 1
    for line in lines:
        buf.append(line)
        count += len(line.split())
        if count >= 1500 and (not line.strip() or SECTION_RE.match(line)):
            yield page, "\n".join(buf)
            buf, count, page = [], 0, page + 1
    if buf:
        yield page, "\n".join(buf)


def chunk_page(text: str, words_per_chunk: int, overlap: int):
    """Split page text into overlapping word windows; each chunk carries the section it starts in."""
    tagged = list(_tag_words(text))
    step = max(words_per_chunk - overlap, 1)
    for start in range(0, len(tagged), step):
        window = tagged[start:start + words_per_chunk]
        chunk = " ".join(w for w, _ in window)
        # most common section label inside this window
        labels = [s for _, s in window if s]
        section = max(set(labels), key=labels.count) if labels else ""
        yield chunk, section
        if start + words_per_chunk >= len(tagged):
            break


def build_chunks(src_path: Path):
    head = ""
    if src_path.suffix.lower() != ".pdf":
        head = src_path.read_text(encoding="utf-8", errors="ignore")[:2000]
    meta = load_metadata(src_path, head)
    docs, metas, ids = [], [], []
    n = 0
    for page_no, text in extract_pages(src_path):
        for chunk, section in chunk_page(text, config.CHUNK_WORDS, config.CHUNK_OVERLAP):
            n += 1
            docs.append(chunk)
            metas.append({
                **meta,
                "section": section or "n/a",
                "page": page_no,
                "source_file": src_path.name,
            })
            ids.append(f"{src_path.stem}__p{page_no}__c{n}")
    return docs, metas, ids


SUPPORTED = {".pdf", ".md", ".txt"}


def find_sources():
    """All PDFs / markdown / text under data/raw and markdown_output (recursive)."""
    roots = [config.RAW_DIR, config.RAW_DIR.parent.parent / "markdown_output"]
    files = []
    for root in roots:
        if root.exists():
            files += [p for p in root.rglob("*") if p.suffix.lower() in SUPPORTED and p.is_file()]
    return sorted(set(files))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--reset", action="store_true", help="delete existing DB first")
    args = parser.parse_args()

    if args.reset and config.CHROMA_DIR.exists():
        shutil.rmtree(config.CHROMA_DIR)
        print(f"Deleted {config.CHROMA_DIR}")

    sources = find_sources()
    if not sources:
        print(f"No documents found in {config.RAW_DIR} or markdown_output/. Add PDF/MD files.")
        sys.exit(1)

    print(f"Loading embedding model {config.EMBED_MODEL} (first run downloads ~2GB)...")
    embedder = SentenceTransformer(config.EMBED_MODEL)

    client = chromadb.PersistentClient(path=str(config.CHROMA_DIR))
    collection = client.get_or_create_collection(
        name=config.COLLECTION_NAME, metadata={"hnsw:space": "cosine"}
    )

    total = 0
    for src in sources:
        print(f"Processing {src.relative_to(config.RAW_DIR.parent.parent)} ...")
        docs, metas, ids = build_chunks(src)
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
