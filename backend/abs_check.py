"""
Access-and-Benefit-Sharing (ABS) compliance helper.

Rule-based checklist under the Biological Diversity Act 2002 (as amended 2023) and
Biological Diversity Rules 2024. Tells the user whether NBA / State Biodiversity Board
approval or intimation is likely needed, and which obligations apply.

IMPORTANT: outputs are informational pointers, not legal determinations.
"""

QUESTIONS = [
    {"id": "resource", "text": "Does your product use a biological resource (plant, animal, microbe, or their parts/extracts) obtained from India?",
     "options": ["yes", "no"]},
    {"id": "entity", "text": "Who is the applicant?",
     "options": ["Indian individual or Indian-owned company", "Foreign national or company", "Indian company with foreign shareholding/control"]},
    {"id": "purpose", "text": "What is the primary purpose?",
     "options": ["commercial utilisation (sale of product)", "research only", "transfer of research results abroad"]},
    {"id": "ip", "text": "Are you applying for IP (patent or plant-variety right) on an invention based on this resource?",
     "options": ["yes", "no"]},
    {"id": "practitioner", "text": "Are you a registered AYUSH practitioner or a cultivator using your own cultivated stock?",
     "options": ["yes", "no"]},
    {"id": "tk", "text": "Does the product rely on codified traditional knowledge (e.g. texts in the First Schedule of the D&C Act) or knowledge held by a local community?",
     "options": ["codified traditional knowledge", "community-held knowledge", "neither"]},
]

# Legal references used in the output (keep these accurate; data team can verify against the corpus)
REF_BD_ACT = "Biological Diversity Act, 2002 (as amended 2023)"
REF_BD_RULES = "Biological Diversity Rules, 2024"
REF_PATENTS = "Patents Act, 1970, Section 10(4)(d) and Section 3(p)"


def abs_check(a: dict) -> dict:
    steps, obligations, refs = [], [], set()
    likely = "not applicable"

    if a.get("resource") == "no":
        return {
            "likely_requirement": "not applicable",
            "summary": "No Indian biological resource is used, so the ABS provisions of the Biological Diversity Act are not triggered. "
                       "Other IP and regulatory rules still apply.",
            "steps": [], "obligations": [], "references": [REF_BD_ACT],
        }

    entity = a.get("entity", "")
    purpose = a.get("purpose", "")
    foreign = "Foreign" in entity or "foreign" in entity

    if foreign:
        likely = "prior approval of the National Biodiversity Authority (NBA)"
        steps.append("Apply to NBA for prior approval before accessing the resource or associated knowledge (Section 3).")
        refs.add(REF_BD_ACT)
        if "transfer" in purpose:
            steps.append("Separate NBA approval is required before transferring research results abroad (Section 4).")
    else:
        if "commercial" in purpose:
            likely = "prior intimation to the State Biodiversity Board (SBB)"
            steps.append("Give prior intimation to the State Biodiversity Board before commercial utilisation (Section 7).")
            refs.add(REF_BD_ACT)
        elif "research" in purpose:
            likely = "generally exempt for research by Indian entities"
            steps.append("Pure research by Indian citizens/entities does not require prior intimation, but keep records of source and quantity.")

    if a.get("practitioner") == "yes":
        steps.append("Registered AYUSH practitioners and cultivators using their own cultivated stock are exempt from Section 7 intimation; "
                     "the exemption is narrow — confirm your activity falls inside it (Section 7 proviso, 2023 amendment).")

    if a.get("ip") == "yes":
        steps.append("Obtain NBA approval before the grant of the patent (Section 6). File the application first, then apply to NBA with the application number.")
        steps.append("Disclose the source and geographical origin of the biological material in the patent specification (Patents Act s.10(4)(d)).")
        refs.update([REF_BD_ACT, REF_PATENTS])
        obligations.append("Patent application must disclose source of biological material.")

    if "commercial" in purpose or foreign:
        obligations.append("Benefit sharing is payable on commercial utilisation; rates and modes are fixed under the 2024 Rules "
                           "(monetary or non-monetary, negotiated with NBA/SBB).")
        refs.add(REF_BD_RULES)

    tk = a.get("tk", "")
    if tk == "codified traditional knowledge":
        obligations.append("Codified traditional knowledge is prior art for patents (s.3(p)); TKDL will be consulted by examiners. "
                           "Benefit-sharing for codified TK follows the 2023 amendment's relaxed regime for AYUSH practitioners.")
        refs.add(REF_PATENTS)
    elif tk == "community-held knowledge":
        obligations.append("Prior informed consent of the knowledge-holding community and benefit sharing with them is expected; "
                           "record the community and Biodiversity Management Committee consulted.")
        refs.add(REF_BD_ACT)

    summary = f"Likely requirement: {likely}. " + (
        "Complete the steps below before commercialising or filing IP." if steps else "")

    return {
        "likely_requirement": likely,
        "summary": summary,
        "steps": steps,
        "obligations": obligations,
        "references": sorted(refs),
        "disclaimer": "Informational checklist, not a legal determination. Confirm with NBA/SBB or a qualified professional.",
    }


if __name__ == "__main__":
    import json
    print(json.dumps(abs_check({"resource": "yes", "entity": "Indian individual or Indian-owned company",
                                "purpose": "commercial utilisation (sale of product)", "ip": "yes",
                                "practitioner": "no", "tk": "codified traditional knowledge"}), indent=2))
