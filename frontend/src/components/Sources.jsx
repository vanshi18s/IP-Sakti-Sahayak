import { useEffect, useState } from "react";
import { api } from "../api.js";

// Shows every document in the corpus with its version — the "version-tracked corpus" the brief asks for.
export default function Sources() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    api.sources().then(setRows).catch(() => setRows([]));
  }, []);

  if (rows === null) return <p className="text-sm text-ink-soft">Loading corpus…</p>;
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No documents ingested yet.</p>;

  const byJur = { India: [], International: [] };
  rows.forEach((r) => (byJur[r.jurisdiction] || (byJur[r.jurisdiction] = [])).push(r));

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-ink-soft">
        Every answer is drawn only from these documents. Each entry records the version we indexed, so
        answers can be traced to the law as it stood on that date.
      </p>
      {Object.entries(byJur).map(([jur, docs]) =>
        docs.length ? (
          <div key={jur}>
            <h3 className="text-lg text-leaf mb-2">{jur}</h3>
            <table className="w-full text-sm bg-paper border border-sage-deep rounded-md overflow-hidden">
              <thead className="text-xs text-ink-soft text-left">
                <tr>
                  <th className="px-3 py-2">Document</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Version</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.doc} className="border-t border-sage-deep">
                    <td className="px-3 py-2 font-semibold">{d.doc}</td>
                    <td className="px-3 py-2">{d.doc_type}</td>
                    <td className="px-3 py-2">{d.version_date || "—"}</td>
                    <td className="px-3 py-2">
                      {d.url ? (
                        <a href={d.url} target="_blank" rel="noreferrer" className="text-leaf underline underline-offset-2">
                          Official text
                        </a>
                      ) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null
      )}
    </div>
  );
}
