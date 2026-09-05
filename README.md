# IP-Sakti-Sahayak

# IP-SAKTI Sahayak — Workflow & Research Report
**Problem Statement:** SIH26045 · Ministry of Ayush · Software
**Title:** IP-SAKTI Sahayak — a multilingual, RAG-based (source-cited) AI assistant for Intellectual Property and regulatory guidance in Ayurveda, across national and international regimes.

> Note: Verify the official "Background / Expected Solution" text on sih.gov.in and paste it into Section 1.2 before submission.

---

## PART A — WORKFLOW

### A.1 System overview

IP-SAKTI Sahayak is a Retrieval-Augmented Generation (RAG) assistant. Instead of letting a language model answer from memory (and hallucinate), it first retrieves the exact passages from an indexed corpus of laws, rules and guidelines, then generates an answer grounded in those passages, and cites them. Users can ask in Hindi, English or other Indian languages.

### A.2 High-level architecture

```
User (Web / Mobile / WhatsApp)
        │  question in any supported language
        ▼
┌─────────────────────┐
│ 1. Language Layer   │  detect language → translate to English (IndicTrans2 / Bhashini)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 2. Query Processing │  classify intent (IP / regulatory / export / general)
│                     │  identify jurisdiction (India / US / EU / WIPO / other)
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 3. Retriever        │  embed query → hybrid search (vector + BM25) over Vector DB
│                     │  filter by jurisdiction/document type → re-rank top-k chunks
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 4. Generator (LLM)  │  prompt = system rules + retrieved chunks + question
│                     │  answer ONLY from context; attach citation IDs; flag uncertainty
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 5. Citation & Guard │  verify every claim maps to a chunk; add disclaimer;
│                     │  refuse if no relevant source found
└─────────┬───────────┘
          ▼
┌─────────────────────┐
│ 6. Language Layer   │  translate answer back to user's language
└─────────┬───────────┘
          ▼
   Answer + source list (Act, Section, page, URL) + confidence

Offline pipeline (Data Preprocessing team):
Source docs (PDF/HTML) → extract text (OCR if scanned) → clean → chunk (400–800 tokens, section-aware)
→ attach metadata (act name, section, jurisdiction, date, URL) → embed → store in Vector DB
```

### A.3 Step-by-step workflow

**Phase 1 — Knowledge base construction (offline)**
1. Collect authoritative documents (see A.5).
2. Convert to text; run OCR on scanned gazette PDFs.
3. Clean: remove headers/footers, fix encoding, keep section numbering.
4. Chunk by legal structure (Section / Rule / Article), not by fixed length alone.
5. Attach metadata to each chunk: `{doc_title, section, jurisdiction, doc_type, effective_date, source_url}`.
6. Generate embeddings (multilingual model such as `bge-m3` or `multilingual-e5`).
7. Store in a vector database (Chroma / FAISS / Qdrant) with a parallel keyword index.

**Phase 2 — Query handling (online)**
1. Receive query; detect language.
2. Translate to English for retrieval (keeps a single-language index; simpler and more accurate).
3. Classify intent and jurisdiction to narrow the search space.
4. Retrieve top-k chunks (k ≈ 8–10) using hybrid search; re-rank with a cross-encoder.
5. Build prompt with strict grounding instructions.
6. LLM generates answer with inline citation markers `[1] [2]`.
7. Post-check: each marker must resolve to a retrieved chunk; unsupported sentences are dropped.
8. Translate answer back; render sources as clickable references.
9. Log query + retrieved docs (for evaluation and improvement).

**Phase 3 — Evaluation & feedback**
- Golden Q&A set (50–100 questions written with a domain expert).
- Metrics: retrieval recall@k, citation accuracy, answer faithfulness (RAGAS), language quality.
- Thumbs-up/down feedback loop in the UI.

### A.4 Suggested tech stack

| Layer | Option |
|---|---|
| Frontend | React / Next.js; optional WhatsApp via Twilio or Meta API |
| Backend | Python, FastAPI |
| Orchestration | LangChain or LlamaIndex |
| Embeddings | bge-m3 / multilingual-e5-large (open source) |
| Vector DB | Chroma (prototype) → Qdrant / pgvector (scale) |
| LLM | Open-weight (Llama 3 / Mistral / Sarvam) or API (Gemini / GPT / Claude) |
| Translation | IndicTrans2, Bhashini APIs |
| Re-ranker | bge-reranker |
| Evaluation | RAGAS, custom test set |
| Deployment | Docker; cloud or on-prem (govt data sensitivity) |

### A.5 Knowledge base — source list

**India (IP)**
- The Patents Act, 1970 & Patent Rules, 2003 (esp. Section 3(p) on traditional knowledge)
- Trade Marks Act, 1999
- Geographical Indications of Goods Act, 1999
- Copyright Act, 1957 (for texts, formulations documentation)
- Biological Diversity Act, 2002 & NBA guidelines (access & benefit sharing)
- Traditional Knowledge Digital Library (TKDL) — overview & access norms
- Indian Patent Office Manual of Patent Practice & Procedure
- National IPR Policy, 2016

**India (Regulatory)**
- Drugs and Cosmetics Act, 1940 & Rules, 1945 (Chapter IV-A: ASU drugs)
- Ayurvedic Pharmacopoeia of India (API) & Ayurvedic Formulary of India (AFI)
- Ministry of Ayush notifications, GMP (Schedule T), licensing guidelines
- FSSAI regulations for Ayurveda-based nutraceuticals / health supplements
- Pharmacovigilance guidelines for ASU drugs
- Export requirements: APEDA, Pharmexcil, AYUSH export policy

**International**
- WIPO: IGC on Genetic Resources, Traditional Knowledge & Folklore; 2024 WIPO Treaty on Genetic Resources
- TRIPS Agreement (WTO)
- Nagoya Protocol (Convention on Biological Diversity)
- USA: FDA Dietary Supplement Health and Education Act (DSHEA), Botanical Drug Guidance, USPTO guidelines
- EU: Directive 2004/24/EC (Traditional Herbal Medicinal Products), EMA HMPC monographs, Novel Food Regulation
- WHO Traditional Medicine Strategy 2025–2034; WHO Benchmarks for Ayurveda training/practice
- Selected country rules: UK MHRA, Canada NNHPD, Australia TGA

---

## PART B — RESEARCH REPORT

### 1. Introduction

#### 1.1 Context
India's Ayurveda sector — manufacturers, MSMEs, startups, research institutions and practitioners — increasingly seeks to protect formulations and enter global markets. Doing so requires navigating two complex, fragmented domains at once: intellectual property (patents, trademarks, GIs, traditional-knowledge protection) and regulatory compliance (licensing, GMP, pharmacopoeial standards, export rules). Information is spread across dozens of Acts, rules, gazette notifications and international instruments, mostly in English legalese.

#### 1.2 Problem statement (official)
_[Paste official background text from sih.gov.in here.]_

#### 1.3 Objective
To build a multilingual, source-cited AI assistant that gives reliable, traceable guidance on IP and regulatory questions in Ayurveda, covering Indian and major international regimes.

### 2. Problem analysis

#### 2.1 Who is affected
- MSME Ayurvedic manufacturers unsure whether a formulation is patentable or already covered by TKDL.
- Startups seeking trademarks, GIs, or export approvals (US, EU).
- Researchers at AIIA / CCRAS / universities filing patents on classical-formulation modifications.
- Practitioners and students needing licensing and compliance clarity.
- Government officers answering repetitive queries.

#### 2.2 Pain points
- Fragmented sources; no single authoritative portal.
- Legal language inaccessible to non-English speakers.
- Generic chatbots hallucinate legal facts — dangerous in IP/regulatory contexts.
- High dependence on costly consultants.
- Historical bio-piracy cases (Neem, Turmeric, Basmati) show the cost of weak awareness.

#### 2.3 Why now
- India's AYUSH market and export push (Ayush Visa, Ayush Export Promotion Council).
- WHO Global Traditional Medicine Centre (Jamnagar) raising international interest.
- 2024 WIPO treaty on genetic resources and traditional knowledge changes disclosure requirements globally.
- Maturity of RAG and Indic-language models makes a trustworthy assistant feasible.

### 3. Existing solutions & gaps

| Solution | Limitation |
|---|---|
| IP India / Ayush ministry websites | Static, hard to search, English-only |
| TKDL | Restricted access; not a Q&A system |
| Generic LLM chatbots | No citations; hallucinate sections and rules |
| Legal consultants | Expensive, slow, not scalable |
| Existing legal-AI tools | Not Ayurveda-specific; no traditional-knowledge or AYUSH regulatory coverage |

**Gap:** No multilingual, citation-grounded assistant focused on Ayurveda IP + regulation across jurisdictions.

### 4. Proposed solution

#### 4.1 Core idea
A RAG pipeline over a curated corpus of statutes, rules and guidelines, with strict grounding so every answer is traceable to a source passage. Multilingual input/output through Indic translation models.

#### 4.2 Key features
1. Multilingual chat (Hindi, English + regional languages via Bhashini).
2. Source-cited answers with Act / Section / page / link.
3. Jurisdiction selector (India / US / EU / WIPO).
4. Guided flows: "Can I patent this?", "How to get an AYUSH license?", "Export to EU checklist".
5. Document upload: user uploads a formulation description; assistant checks relevant provisions.
6. Confidence indicator and mandatory disclaimer ("informational, not legal advice").
7. Admin panel to add/update documents when laws change.

#### 4.3 Technical approach
See Part A. Key design choices:
- **Hybrid retrieval** (dense + keyword) because legal queries often hinge on exact terms (section numbers, defined terms).
- **Section-aware chunking** preserves legal context.
- **Metadata filtering** by jurisdiction cuts irrelevant retrieval.
- **Grounding guardrails**: refuse when no source is found; never answer from model memory.
- **Translate-then-retrieve** keeps one high-quality English index while serving many languages.

#### 4.4 Innovation / uniqueness
- First Ayurveda-specific IP + regulatory assistant spanning national and international regimes.
- Citation verification layer (post-generation check) rather than trusting the LLM.
- Traditional-knowledge awareness: flags potential TKDL / Section 3(p) conflicts.
- Built for Indic languages from day one.

### 5. Feasibility

| Aspect | Assessment |
|---|---|
| Technical | Mature open-source RAG stack; prototype achievable in hackathon window |
| Data | Sources are public government documents; no licensing barrier |
| Cost | Open-weight models + small vector DB run on modest hardware |
| Scalability | Stateless API; vector DB scales horizontally |
| Maintainability | Admin ingestion pipeline handles new notifications |

### 6. Challenges & mitigation

| Challenge | Mitigation |
|---|---|
| Legal hallucination | Strict grounding, citation verification, refusal policy |
| Laws change frequently | Versioned documents with effective dates; re-ingestion pipeline |
| Translation errors in legal terms | Glossary of legal terms kept untranslated; human-reviewed test set |
| Scanned/poor PDFs | OCR + manual QA for core documents |
| Liability | Clear disclaimer; positioned as guidance, not legal advice |
| Evaluation | Expert-reviewed golden Q&A set; RAGAS metrics |

### 7. Impact & benefits

- **Social:** Democratises legal knowledge for rural MSMEs and non-English users.
- **Economic:** Lowers consultancy costs; speeds up IP filing and market entry; supports Ayush exports.
- **Government:** Reduces query load on ministry helpdesks; consistent, auditable answers.
- **Research:** Helps institutions avoid rejected filings and protect traditional knowledge.
- **Strategic:** Strengthens India's position against bio-piracy.

### 8. Future scope
- Integration with IP India e-filing and Ayush licensing portals.
- Voice interface for low-literacy users.
- Expansion to Unani, Siddha, Homoeopathy (full AYUSH).
- Alerts when new notifications affect a user's saved product.
- Country-by-country export compliance checker.

### 9. Conclusion
IP-SAKTI Sahayak addresses a concrete, high-value gap with a technically feasible, low-cost architecture. Its defining strength is trust: multilingual access combined with verifiable citations makes it usable for real IP and regulatory decisions, not just information browsing.

### 10. References
_(Fill with actual URLs when finalising)_
1. The Patents Act, 1970 — ipindia.gov.in
2. Drugs and Cosmetics Act, 1940 & Rules, 1945 — cdsco.gov.in
3. Ministry of Ayush — ayush.gov.in
4. Traditional Knowledge Digital Library — tkdl.res.in
5. WIPO Treaty on IP, Genetic Resources and Associated Traditional Knowledge (2024) — wipo.int
6. EU Directive 2004/24/EC — eur-lex.europa.eu
7. US FDA Botanical Drug Development Guidance — fda.gov
8. WHO Traditional Medicine Strategy 2025–2034 — who.int
9. Lewis, P. et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks.
10. Bhashini / IndicTrans2 — bhashini.gov.in, ai4bharat.iitm.ac.in
