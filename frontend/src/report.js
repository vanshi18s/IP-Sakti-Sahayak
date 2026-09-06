// Builds a printable report in a new window and triggers "Save as PDF".
// Works for a single Q&A (results = {India: {...}}) or a document review.

const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const STYLE = `
  body { font-family: Georgia, "Noto Serif", serif; color: #17201b; margin: 40px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #1f3a2b; }
  h2 { font-size: 16px; margin: 24px 0 8px; color: #1f3a2b; border-bottom: 1px solid #dde5d7; padding-bottom: 4px; }
  .meta { font-size: 12px; color: #55635b; margin-bottom: 20px; }
  .q { font-size: 15px; font-weight: bold; margin: 8px 0; }
  .a { white-space: pre-wrap; font-size: 14px; }
  .src { font-size: 12px; margin: 6px 0 6px 12px; padding-left: 8px; border-left: 3px solid #d9820b; }
  .src b { color: #d9820b; }
  .conf { font-size: 12px; color: #55635b; }
  .disc { margin-top: 30px; font-size: 11px; color: #55635b; border-top: 1px solid #dde5d7; padding-top: 8px; }
  @media print { body { margin: 20px; } }
`;

function sourcesHtml(sources) {
  if (!sources?.length) return "<div class='conf'>No sources cited.</div>";
  return sources.map((s) =>
    `<div class="src"><b>[${s.id}]</b> ${esc(s.doc)} · ${esc(s.section)} · page ${s.page} · ${esc(s.jurisdiction)}` +
    (s.version_date ? ` · version ${esc(s.version_date)}` : "") +
    (s.url ? `<br><span style="color:#1f3a2b">${esc(s.url)}</span>` : "") + `</div>`
  ).join("");
}

function answerBlock(title, r) {
  return `
    <h2>${esc(title)}</h2>
    <div class="conf">Confidence ${Math.round((r.confidence || 0) * 100)}%${r.abstained ? " · abstained" : ""}</div>
    <div class="a">${esc(r.answer)}</div>
    ${r.answer_en ? `<div class="conf" style="margin-top:8px">English original</div><div class="a">${esc(r.answer_en)}</div>` : ""}
    ${sourcesHtml(r.sources)}`;
}

export function exportQA({ question, results, user, differences }) {
  const body = Object.entries(results).map(([j, r]) =>
    answerBlock(j === "India" ? "Under Indian law" : "Under international regimes", r)).join("");
  const diff = differences ? `<h2>Key differences</h2><div class="a">${esc(differences)}</div>` : "";
  open(`
    <h1>IP-SAKTI Sahayak — guidance report</h1>
    <div class="meta">${new Date().toLocaleString()}${user ? ` · prepared for ${esc(user.name)} (${esc(user.email)})` : ""}</div>
    <div class="q">Question: ${esc(question)}</div>
    ${body}${diff}`);
}

export function exportReview(review, user) {
  const checks = review.checks.map((c) => answerBlock(c.title, c)).join("");
  open(`
    <h1>IP-SAKTI Sahayak — document review</h1>
    <div class="meta">${new Date().toLocaleString()} · file: ${esc(review.filename)}${user ? ` · ${esc(user.name)}` : ""}</div>
    <h2>Product summary</h2><div class="a">${esc(review.product_summary)}</div>
    ${checks}`);
}

function open(inner) {
  const w = window.open("", "_blank");
  if (!w) return alert("Allow pop-ups to download the report.");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>IP-SAKTI report</title><style>${STYLE}</style></head>
    <body>${inner}<div class="disc">This report provides information, not legal advice. Every statement is traceable to the cited source; verify with the official text or a qualified IP professional.</div>
    <script>window.onload=()=>{window.print();}</script></body></html>`);
  w.document.close();
}
