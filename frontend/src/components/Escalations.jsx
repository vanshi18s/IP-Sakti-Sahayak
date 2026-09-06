import { useEffect, useState } from "react";
import { api } from "../api.js";

// Facilitator view: questions users escalated for human review.
export default function Escalations() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.escalations().then(setRows).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-sm text-danger">{error}</p>;
  if (rows === null) return <p className="text-sm text-ink-soft">Loading…</p>;
  if (rows.length === 0) return <p className="text-sm text-ink-soft">No escalated questions yet.</p>;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink-soft">{rows.length} question{rows.length > 1 ? "s" : ""} waiting for a human answer.</p>
      {rows.map((r, i) => (
        <div key={i} className="bg-paper border border-sage-deep rounded-md p-3">
          <div className="text-sm font-semibold">{r.query}</div>
          <div className="text-xs text-ink-soft mt-1">
            {r.email} · {new Date(r.ts).toLocaleString()} {r.reason && `· ${r.reason}`}
          </div>
        </div>
      ))}
    </div>
  );
}
