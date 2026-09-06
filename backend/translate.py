"""
Translation layer. Question comes in any Indian language -> English for retrieval;
answer goes back in the user's language.

Backends:
  llm      – uses the same Groq model (default; zero extra setup, good quality)
  bhashini – hook for the government Bhashini API (needs registration; fill in later)
  none     – pass-through
"""
import re
from functools import lru_cache

import config

LANG_NAMES = {
    "en": "English", "hi": "Hindi", "mr": "Marathi", "ta": "Tamil", "te": "Telugu",
    "kn": "Kannada", "ml": "Malayalam", "bn": "Bengali", "gu": "Gujarati", "pa": "Punjabi",
    "or": "Odia", "sa": "Sanskrit",
}

DEVANAGARI = re.compile(r"[\u0900-\u097F]")
TAMIL = re.compile(r"[\u0B80-\u0BFF]")
TELUGU = re.compile(r"[\u0C00-\u0C7F]")
KANNADA = re.compile(r"[\u0C80-\u0CFF]")
MALAYALAM = re.compile(r"[\u0D00-\u0D7F]")
BENGALI = re.compile(r"[\u0980-\u09FF]")
GUJARATI = re.compile(r"[\u0A80-\u0AFF]")
GURMUKHI = re.compile(r"[\u0A00-\u0A7F]")
ODIA = re.compile(r"[\u0B00-\u0B7F]")


def detect_language(text: str) -> str:
    """Cheap script-based detection. Returns a BCP-47-ish code; 'en' for Latin script."""
    checks = [("hi", DEVANAGARI), ("ta", TAMIL), ("te", TELUGU), ("kn", KANNADA), ("ml", MALAYALAM),
              ("bn", BENGALI), ("gu", GUJARATI), ("pa", GURMUKHI), ("or", ODIA)]
    for code, rx in checks:
        if rx.search(text):
            return code
    return "en"


# ---------- LLM backend ----------

TRANSLATE_SYS = (
    "You are a professional legal translator. Translate the user's text from {src} to {tgt}. "
    "Keep legal terms, Act names, section numbers, and citation markers like [1] exactly as they are. "
    "Output only the translation, nothing else."
)


def _llm_translate(text: str, src: str, tgt: str) -> str:
    from rag import _chat  # lazy import to avoid circular import at module load
    system = TRANSLATE_SYS.format(src=LANG_NAMES.get(src, src), tgt=LANG_NAMES.get(tgt, tgt))
    out = _chat(system, text, temperature=0.0, max_tokens=1500)
    return out or text


# ---------- Bhashini backend (stub) ----------

def _bhashini_translate(text: str, src: str, tgt: str) -> str:
    """
    TODO when the team registers at https://bhashini.gov.in/ulca :
      1. Put BHASHINI_USER_ID and BHASHINI_API_KEY in .env
      2. Call the pipeline config endpoint to get the translation service id
      3. POST to the compute endpoint with {"input": [{"source": text}], "config": {...}}
    Until then this falls back to the LLM backend.
    """
    return _llm_translate(text, src, tgt)


# ---------- public API ----------

def to_english(text: str, src: str | None = None) -> tuple[str, str]:
    """Return (english_text, detected_lang)."""
    src = src or detect_language(text)
    if src == "en" or config.TRANSLATE_BACKEND == "none":
        return text, src
    fn = _bhashini_translate if config.TRANSLATE_BACKEND == "bhashini" else _llm_translate
    return fn(text, src, "en"), src


FULLWIDTH_CITE = re.compile(r"[【\[]\s*(\d+)\s*[】\]]")


def from_english(text: str, tgt: str) -> str:
    if tgt == "en" or config.TRANSLATE_BACKEND == "none" or not text:
        return text
    fn = _bhashini_translate if config.TRANSLATE_BACKEND == "bhashini" else _llm_translate
    out = fn(text, "en", tgt)
    return FULLWIDTH_CITE.sub(r"[\1]", out)   # translators often swap brackets for 【】


if __name__ == "__main__":
    q = "क्या शास्त्रीय आयुर्वेदिक योग का पेटेंट भारत में हो सकता है?"
    en, lang = to_english(q)
    print(lang, "->", en)
    print(from_english("A classical formulation cannot be patented under Section 3(p) [1].", "hi"))
