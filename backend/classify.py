"""
Formulation classification flow (required by the problem statement).

Three fixed questions -> product category -> its IP / ABS / regulatory posture.
Deterministic rules, no LLM needed, so it is fast and explainable.
"""

QUESTIONS = [
    {
        "id": "q1",
        "text": "Is the formulation and its method of preparation taken as-is from an authoritative "
                "Ayurvedic text listed in the First Schedule of the Drugs & Cosmetics Act (e.g. Charaka Samhita, "
                "Bhaishajya Ratnavali)?",
        "options": ["yes", "no"],
    },
    {
        "id": "q2",
        "text": "What is the intended use / claim of the product?",
        "options": ["treat or prevent disease", "general wellness or nutrition", "external cosmetic use"],
    },
    {
        "id": "q3",
        "text": "Does the product contain a new ingredient, new dosage form, or a purified/standardised "
                "extract not described in classical texts, or make a claim needing new safety/efficacy data?",
        "options": ["yes", "no"],
    },
]

CATEGORIES = {
    "classical": {
        "name": "Classical / Generic Ayurvedic Medicine",
        "regulatory": "Licensed under Drugs & Cosmetics Rules 1945, Rule 158B (classical). Must follow the First "
                      "Schedule text and pharmacopoeial standards (API/AFI). GMP under Schedule T.",
        "ip": "Formulation is traditional knowledge: patent barred by Patents Act s.3(p); prior art defended via TKDL. "
              "Protect brand via trademark; consider GI if region-linked; process/packaging innovations may be patentable.",
        "abs": "Use of Indian biological resources may still trigger Biological Diversity Act ABS obligations for "
               "commercial use; check NBA / State Biodiversity Board requirements.",
    },
    "proprietary": {
        "name": "Patent-or-Proprietary Ayurvedic Medicine",
        "regulatory": "Licensed under Rule 158B (proprietary). Ingredients must be from authoritative texts; "
                      "proof of safety/effectiveness per Rule 158B and Ministry of Ayush guidelines.",
        "ip": "Novel combinations or processes may be patentable if not mere admixture (s.3(e)) and not TK (s.3(p)). "
              "Strong trademark protection recommended; keep formulation know-how as trade secret.",
        "abs": "Commercial use of Indian biological resources -> NBA approval / benefit sharing under BD Act 2002 "
               "(amended 2023) and 2024 Rules; disclosure of source in patent application (s.10(4)(d)).",
    },
    "new_drug": {
        "name": "New / Non-classical Drug (incl. Phytopharmaceutical)",
        "regulatory": "Treated as a new drug: clinical safety and efficacy data required; phytopharmaceuticals follow "
                      "the D&C Rules phytopharmaceutical pathway (Schedule Y-type evidence).",
        "ip": "Genuine patent potential (composition, process, use) subject to s.3(d), s.3(e), s.3(p); "
              "consider PCT filing for international protection.",
        "abs": "Mandatory ABS compliance and biological-resource disclosure; WIPO GRATK Treaty (2024) disclosure "
               "requirements apply in signatory jurisdictions.",
    },
    "aahar": {
        "name": "Ayurveda-Aahar / Nutraceutical",
        "regulatory": "Regulated by FSSAI (Ayurveda Aahar Regulations 2022). No disease claims; labelling and "
                      "advertising rules apply; Drugs & Magic Remedies Act restricts claims.",
        "ip": "Trademark and trade dress are primary; recipes generally not patentable unless novel process.",
        "abs": "ABS obligations apply if Indian biological resources used commercially.",
    },
    "cosmetic": {
        "name": "Ayurvedic Cosmetic",
        "regulatory": "Cosmetics Rules 2020 under D&C Act; Ayurvedic cosmetic licence via State Licensing Authority.",
        "ip": "Trademark, design registration for packaging, trade secret for formulation; patents possible for novel "
              "compositions.",
        "abs": "ABS obligations apply if Indian biological resources used commercially.",
    },
}


def classify(answers: dict) -> dict:
    q1 = answers.get("q1", "").lower()
    q2 = answers.get("q2", "").lower()
    q3 = answers.get("q3", "").lower()

    if "cosmetic" in q2:
        key = "cosmetic"
    elif "wellness" in q2 or "nutrition" in q2:
        key = "aahar"
    elif q3 == "yes":
        key = "new_drug"
    elif q1 == "yes":
        key = "classical"
    else:
        key = "proprietary"

    return {"category_key": key, **CATEGORIES[key]}


if __name__ == "__main__":
    print(classify({"q1": "yes", "q2": "treat or prevent disease", "q3": "no"}))
