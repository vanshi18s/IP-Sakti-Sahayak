import { useState } from "react";
import { api } from "../api.js";

const inr = (n) => "₹" + Number(n).toLocaleString("en-IN");

// Official-fee estimator: itemised like a bill, each line tied to its schedule entry.
export default function Fees() {
  const [f, setF] = useState({
    ip_type: "patent", applicant: "small", filing_mode: "e", sheets: 30, claims: 10,
    examination: "normal", early_publication: false, renewal_years: 0, tm_classes: 1, gi_authorised_users: 0,
  });
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) =>
    setF({ ...f, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? Number(e.target.value) : e.target.value });

  const run = async () => {
    setBusy(true);
    try { setResult(await api.fees(f)); } finally { setBusy(false); }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm text-ink-soft">
        Statutory government fees only, shown line by line with the schedule entry each one comes from.
        Attorney charges are not included.
      </p>

      <div className="grid md:grid-cols-3 gap-4">
        <Select label="What are you filing?" value={f.ip_type} onChange={set("ip_type")}
                options={[["patent", "Patent"], ["trademark", "Trade mark"], ["gi", "Geographical Indication"]]} />
        {f.ip_type !== "gi" && (
          <Select label="Applicant" value={f.applicant} onChange={set("applicant")}
                  options={[["small", "Individual / startup / small entity / educational institution"], ["other", "Company or other applicant"]]} />
        )}
        {f.ip_type === "patent" && (
          <>
            <Select label="Filing mode" value={f.filing_mode} onChange={set("filing_mode")}
                    options={[["e", "Online (e-filing)"], ["physical", "Paper filing (+10%)"]]} />
            <Num label="Pages in specification" value={f.sheets} onChange={set("sheets")} hint="First 30 included" />
            <Num label="Number of claims" value={f.claims} onChange={set("claims")} hint="First 10 included" />
            <Select label="Examination" value={f.examination} onChange={set("examination")}
                    options={[["normal", "Normal (Form 18)"], ["expedited", "Expedited (Form 18A)"], ["none", "Not yet"]]} />
            <Num label="Keep patent alive until year" value={f.renewal_years} onChange={set("renewal_years")} hint="0 = filing costs only; max 20" />
            <label className="flex items-center gap-2 text-sm mt-6">
              <input type="checkbox" checked={f.early_publication} onChange={set("early_publication")} />
              Request early publication (Form 9)
            </label>
          </>
        )}
        {f.ip_type === "trademark" && (
          <Num label="Number of classes" value={f.tm_classes} onChange={set("tm_classes")} hint="Nice classification" />
        )}
        {f.ip_type === "gi" && (
          <Num label="Authorised users to register" value={f.gi_authorised_users} onChange={set("gi_authorised_users")} />
        )}
      </div>

      <button onClick={run} disabled={busy}
              className="self-start text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40">
        {busy ? "Calculating…" : "Calculate fees"}
      </button>

      {result && (
        <div className="bg-paper border border-sage-deep rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-sage-deep flex justify-between text-xs text-ink-soft">
            <span>{result.applicant_category} · {result.filing_mode}</span>
            <span>Amounts in {result.currency}</span>
          </div>
          <table className="w-full text-sm">
            <thead className="text-xs text-ink-soft text-left bg-sage/60">
              <tr>
                <th className="px-4 py-2">Item</th>
                <th className="px-2 py-2 text-right">Qty</th>
                <th className="px-2 py-2 text-right">Unit</th>
                <th className="px-4 py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((l, i) => (
                <tr key={i} className="border-t border-sage-deep align-top">
                  <td className="px-4 py-2">
                    <div className="font-semibold">{l.item}</div>
                    <div className="text-[11px] text-saffron">{l.ref}</div>
                    {l.note && <div className="text-[11px] text-ink-soft">{l.note}</div>}
                  </td>
                  <td className="px-2 py-2 text-right">{l.qty}</td>
                  <td className="px-2 py-2 text-right">{inr(l.unit)}</td>
                  <td className="px-4 py-2 text-right font-semibold">{inr(l.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-leaf bg-sage/40">
                <td className="px-4 py-3 font-semibold" colSpan={3}>Total statutory fees</td>
                <td className="px-4 py-3 text-right text-lg font-bold text-leaf">{inr(result.total)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="px-4 py-3 text-[11px] text-ink-soft border-t border-sage-deep">
            <div>Excludes: {result.excludes}</div>
            <div className="mt-1">{result.disclaimer}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="text-sm flex flex-col gap-1">
      <span className="text-ink-soft">{label}</span>
      <select value={value} onChange={onChange} className="bg-paper border border-sage-deep rounded-md px-2 py-2">
        {options.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
    </label>
  );
}

function Num({ label, value, onChange, hint }) {
  return (
    <label className="text-sm flex flex-col gap-1">
      <span className="text-ink-soft">{label}</span>
      <input type="number" min="0" value={value} onChange={onChange}
             className="bg-paper border border-sage-deep rounded-md px-3 py-2" />
      {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );
}
