"""
Compare the Indian and international answers to the same question and list the key differences.
Pure LLM step over two already-cited answers; it adds no new legal claims of its own.
"""
from rag import _chat

COMPARE_SYS = (
    "You are comparing two answers to the same intellectual-property question: one under Indian law, "
    "one under international regimes. In plain text without markdown, list 3 to 5 short bullet-like lines "
    "starting with '- ' that state the key differences a business owner should know (who must approve, "
    "timelines, what is protectable, what is disclosed, costs if mentioned). If either answer abstained, say so "
    "in one line and compare only what is available. Do not add facts not present in the two answers."
)


def compare_answers(question: str, india: str, intl: str) -> str:
    user = f"QUESTION: {question}\n\nINDIA ANSWER:\n{india}\n\nINTERNATIONAL ANSWER:\n{intl}"
    return _chat(COMPARE_SYS, user, max_tokens=600)
