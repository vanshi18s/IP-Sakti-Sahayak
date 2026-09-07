"""
Guardrails: intent tagging + scope check before retrieval.

Tags every incoming question as one of:
  ip            – patents, trademarks, GI, copyright, designs, trade secrets, prior art
  regulatory    – licensing, Drugs & Cosmetics, FSSAI, advertising, ABS/biodiversity, export
  medical       – asking for treatment, dosage, diagnosis  -> refused, redirected
  out_of_scope  – unrelated (weather, sports, coding...)   -> refused
  unsafe        – illegal activity, harassment             -> refused

Cheap LLM call (one word), then a regex safety net so the LLM can't be talked around.
"""
import re

from rag import _chat

INTENT_SYS = (
    "Classify the user's question into exactly one label and output only that label:\n"
    "ip — intellectual property in Ayurveda/AYUSH (patent, trademark, GI, copyright, design, prior art, TKDL)\n"
    "regulatory — licensing, Drugs and Cosmetics Act, FSSAI, advertising rules, biodiversity/ABS, export compliance\n"
    "medical — asks which medicine to take, dosage, diagnosis, or treatment for a health condition\n"
    "out_of_scope — unrelated to Ayurveda IP or regulation\n"
    "unsafe — requests help with something illegal or harmful"
)

MEDICAL_RX = re.compile(
    r"\b(should i take|what (medicine|dose|dosage)|how much .* (take|consume)|cure my|treat my|symptoms? of|"
    r"prescribe|is it safe to take|side effects? of taking)\b", re.I)

REFUSALS = {
    "medical": "I can't give medical or treatment advice. I can help with the legal side — for example whether a "
               "product can be patented, how it must be licensed, or what claims may be advertised. "
               "For treatment, please consult a registered Ayurvedic practitioner.",
    "out_of_scope": "This assistant only covers intellectual property and regulatory questions for Ayurveda and AYUSH "
                    "products. Try asking about patents, trademarks, GI, licensing, ABS or advertising rules.",
    "unsafe": "I can't help with that request.",
}


def tag_intent(question: str) -> str:
    if MEDICAL_RX.search(question):
        return "medical"
    label = _chat(INTENT_SYS, question, max_tokens=200).strip().lower()
    for key in ("ip", "regulatory", "medical", "out_of_scope", "unsafe"):
        if key in label:
            return key
    return "ip"   # default: let retrieval decide; abstention still applies


def check(question: str) -> dict:
    """Return {'allowed': bool, 'intent': str, 'message': str|None}."""
    intent = tag_intent(question)
    if intent in REFUSALS:
        return {"allowed": False, "intent": intent, "message": REFUSALS[intent]}
    return {"allowed": True, "intent": intent, "message": None}
