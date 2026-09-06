"""
Official fee estimator — itemised like a bill, with the schedule entry each line comes from.

Sources:
  - Patents Rules, 2003, First Schedule (as amended by Patents (Amendment) Rules, 2024) — e-filing fees
  - Trade Marks Rules, 2017, First Schedule
  - Geographical Indications of Goods (Registration and Protection) Rules, 2002, First Schedule

Applicant categories under the Patents Rules:
  "small"  = natural person / startup / small entity / educational institution (reduced fee)
  "other"  = every other applicant (company, LLP, etc.)
Physical (paper) filing costs 10% more than e-filing.

Figures are the official statutory fees only; attorney/agent charges are not included.
"""

# (small, other) in INR, e-filing
PATENT = {
    "application":      (1600, 8000),    # Form 1
    "excess_sheet":     (160, 800),      # per sheet beyond 30
    "excess_claim":     (320, 1600),     # per claim beyond 10
    "examination":      (4000, 20000),   # Form 18, request for examination
    "expedited_exam":   (8000, 60000),   # Form 18A
    "early_publication": (2500, 12500),  # Form 9
    "renewal_3_6":      (800, 4000),     # per year, 3rd–6th year
    "renewal_7_10":     (2400, 12000),   # per year
    "renewal_11_15":    (4800, 24000),   # per year
    "renewal_16_20":    (8000, 40000),   # per year
}
TRADEMARK = {"application_per_class": (4500, 9000)}      # Trade Marks Rules 2017, Form TM-A, e-filing
GI = {"application": 5000, "authorised_user": 500}      # GI Rules 2002, Form GI-1 / GI-3

REF = {
    "application": "Patents Rules 2003, First Schedule, Entry 1 (Form 1)",
    "excess_sheet": "First Schedule, Entry 1 — additional fee for each sheet beyond 30",
    "excess_claim": "First Schedule, Entry 1 — additional fee for each claim beyond 10",
    "examination": "First Schedule, Entry 12 (Form 18)",
    "expedited_exam": "First Schedule, Entry 12A (Form 18A)",
    "early_publication": "First Schedule, Entry 9 (Form 9)",
    "renewal": "First Schedule, Entry 2 — renewal fees under Section 53",
    "physical": "First Schedule — physical filing attracts 10% additional fee",
    "tm": "Trade Marks Rules 2017, First Schedule, Entry 1 (Form TM-A)",
    "gi": "GI Rules 2002, First Schedule (Form GI-1)",
    "gi_user": "GI Rules 2002, First Schedule (Form GI-3, authorised user)",
}


def _pick(pair, applicant):
    return pair[0] if applicant == "small" else pair[1]


def estimate(
    ip_type: str = "patent",          # patent | trademark | gi
    applicant: str = "small",         # small | other
    filing_mode: str = "e",           # e | physical
    sheets: int = 30,
    claims: int = 10,
    examination: str = "normal",      # none | normal | expedited
    early_publication: bool = False,
    renewal_years: int = 0,           # keep patent alive up to this year (max 20)
    tm_classes: int = 1,
    gi_authorised_users: int = 0,
) -> dict:
    lines = []

    def add(label, qty, unit, ref, note=""):
        lines.append({"item": label, "qty": qty, "unit": unit, "amount": qty * unit, "ref": ref, "note": note})

    if ip_type == "patent":
        add("Patent application (Form 1)", 1, _pick(PATENT["application"], applicant), REF["application"])
        if sheets > 30:
            add("Additional sheets beyond 30", sheets - 30, _pick(PATENT["excess_sheet"], applicant), REF["excess_sheet"])
        if claims > 10:
            add("Additional claims beyond 10", claims - 10, _pick(PATENT["excess_claim"], applicant), REF["excess_claim"])
        if early_publication:
            add("Early publication request (Form 9)", 1, _pick(PATENT["early_publication"], applicant), REF["early_publication"])
        if examination == "normal":
            add("Request for examination (Form 18)", 1, _pick(PATENT["examination"], applicant), REF["examination"],
                "Must be filed within 31 months of priority date (Rule 24B, as amended 2024)")
        elif examination == "expedited":
            add("Expedited examination (Form 18A)", 1, _pick(PATENT["expedited_exam"], applicant), REF["expedited_exam"],
                "Available to startups, small entities, natural persons and certain other categories (Rule 24C)")
        yrs = max(0, min(int(renewal_years), 20))
        for band, (lo, hi) in {"renewal_3_6": (3, 6), "renewal_7_10": (7, 10),
                               "renewal_11_15": (11, 15), "renewal_16_20": (16, 20)}.items():
            n = max(0, min(yrs, hi) - lo + 1)
            if n > 0:
                add(f"Renewal fee, years {lo}–{min(yrs, hi)}", n, _pick(PATENT[band], applicant), REF["renewal"],
                    "No renewal fee for the first two years; payable from the 3rd year onwards")
    elif ip_type == "trademark":
        add("Trade mark application (Form TM-A)", max(1, tm_classes), _pick(TRADEMARK["application_per_class"], applicant),
            REF["tm"], "Per class of goods/services (Nice classification)")
    elif ip_type == "gi":
        add("GI registration application (Form GI-1)", 1, GI["application"], REF["gi"],
            "Filed by an association of producers or an organisation representing them")
        if gi_authorised_users > 0:
            add("Authorised user registration (Form GI-3)", gi_authorised_users, GI["authorised_user"], REF["gi_user"])

    subtotal = sum(l["amount"] for l in lines)
    surcharge = 0
    if filing_mode == "physical" and ip_type == "patent":
        surcharge = round(subtotal * 0.10)
        lines.append({"item": "Physical filing surcharge (10%)", "qty": 1, "unit": surcharge,
                      "amount": surcharge, "ref": REF["physical"], "note": ""})

    return {
        "ip_type": ip_type,
        "applicant_category": "Natural person / startup / small entity / educational institution"
                              if applicant == "small" else "Other applicant (company, LLP, etc.)",
        "filing_mode": "e-filing" if filing_mode == "e" else "physical filing",
        "lines": lines,
        "subtotal": subtotal,
        "surcharge": surcharge,
        "total": subtotal + surcharge,
        "currency": "INR",
        "excludes": "Patent agent / attorney professional charges, drafting, translations, courier, and any late fees.",
        "disclaimer": "Statutory fees as per the schedules cited; verify the current schedule on ipindia.gov.in before filing.",
    }


if __name__ == "__main__":
    import json
    print(json.dumps(estimate(applicant="small", sheets=45, claims=14, examination="normal", renewal_years=10), indent=2))
