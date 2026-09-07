"""
Fuzzy name lookup (RapidFuzz) — formulation / document names that vary in spelling and transliteration
(e.g. "Chyawanprash" / "Chyavanaprasha" / "च्यवनप्राश").

Index = every document title in the corpus + every formulation name found in the Ayurvedic Formulary
list files (the numbered .md files from ayush.gov.in). Names are normalised before matching:
lowercase, diacritics stripped, Devanagari transliterated to Roman, common variant spellings collapsed.
"""
import re
from functools import lru_cache
from pathlib import Path

from rapidfuzz import fuzz, process
from unidecode import unidecode

import config

# Devanagari -> Roman (small, deterministic; enough for formulation names)
_DEV = {
    "अ": "a", "आ": "aa", "इ": "i", "ई": "ee", "उ": "u", "ऊ": "oo", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऋ": "ri",
    "क": "k", "ख": "kh", "ग": "g", "घ": "gh", "ङ": "n", "च": "ch", "छ": "chh", "ज": "j", "झ": "jh", "ञ": "n",
    "ट": "t", "ठ": "th", "ड": "d", "ढ": "dh", "ण": "n", "त": "t", "थ": "th", "द": "d", "ध": "dh", "न": "n",
    "प": "p", "फ": "ph", "ब": "b", "भ": "bh", "म": "m", "य": "y", "र": "r", "ल": "l", "व": "v", "श": "sh",
    "ष": "sh", "स": "s", "ह": "h", "ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai",
    "ो": "o", "ौ": "au", "ं": "n", "ः": "h", "्": "", "ृ": "ri", "़": "",
}


def normalise(name: str) -> str:
    s = "".join(_DEV.get(ch, ch) for ch in name)
    s = unidecode(s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    # collapse common transliteration variants
    for a, b in [("aa", "a"), ("ee", "i"), ("oo", "u"), ("chh", "ch"), ("sh", "s"), ("th", "t"), ("dh", "d"),
                 ("bh", "b"), ("ph", "p"), ("kh", "k"), ("gh", "g"), ("jh", "j"), ("w", "v"), ("y", "i")]:
        s = s.replace(a, b)
    s = re.sub(r"(.)\1+", r"\1", s)          # double letters
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _formulary_names():
    """Pull formulation names out of the Ayurvedic Formulary list files (numbered .md files)."""
    root = config.RAW_DIR.parent.parent / "markdown_output"
    names = set()
    for p in root.glob("*.md"):
        if not re.fullmatch(r"\d+", p.stem):
            continue
        for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
            line = re.sub(r"^[\s|#*\-\d.()]+", "", line).strip(" |*")
            if 3 <= len(line) <= 60 and re.search(r"[A-Za-z\u0900-\u097F]", line) and "|" not in line:
                names.add(line)
    return sorted(names)


@lru_cache(maxsize=1)
def _index():
    entries = []                                     # (display, normalised, kind)
    for n in _formulary_names():
        entries.append((n, normalise(n), "formulary"))
    try:
        import chromadb
        coll = chromadb.PersistentClient(path=str(config.CHROMA_DIR)).get_or_create_collection(config.COLLECTION_NAME)
        docs = {m["doc"] for m in coll.get(include=["metadatas"])["metadatas"]}
        for d in docs:
            entries.append((d, normalise(d), "document"))
    except Exception:
        pass
    return entries


def lookup(name: str, k: int = 8) -> dict:
    q = normalise(name)
    idx = _index()
    if not idx:
        return {"query": name, "normalised": q, "matches": []}
    choices = {i: e[1] for i, e in enumerate(idx)}
    hits = process.extract(q, choices, scorer=fuzz.WRatio, limit=k)
    matches = [{"name": idx[i][0], "kind": idx[i][2], "score": round(score)} for _, score, i in hits]
    return {"query": name, "normalised": q, "matches": matches,
            "note": "Score is a transliteration-normalised similarity (RapidFuzz WRatio). Low scores are shown so you can see uncertainty."}


if __name__ == "__main__":
    import json
    print(json.dumps(lookup("Chyavanprash"), indent=2, ensure_ascii=False))
    print(json.dumps(lookup("च्यवनप्राश"), indent=2, ensure_ascii=False))
