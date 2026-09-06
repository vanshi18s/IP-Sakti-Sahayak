import { useState } from "react";
import { api, token } from "../api.js";

// Login / register form. Calls onAuth(user) on success.
export default function Auth({ onAuth, onSkip }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "user" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (mode === "register") {
        await api.register(form.email, form.password, form.name, form.role);
      }
      const out = await api.login(form.email, form.password);
      token.set(out.access_token);
      onAuth(out.user);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-paper border border-sage-deep rounded-lg p-6 flex flex-col gap-4">
      <div>
        <h2 className="text-2xl text-leaf">{mode === "login" ? "Sign in" : "Create an account"}</h2>
        <p className="text-sm text-ink-soft mt-1">
          Sign in to save your questions and escalate them to an IP facilitator.
        </p>
      </div>

      {mode === "register" && (
        <Field label="Your name" value={form.name} onChange={set("name")} />
      )}
      <Field label="Email" type="email" value={form.email} onChange={set("email")} />
      <Field label="Password" type="password" value={form.password} onChange={set("password")}
             hint={mode === "register" ? "At least 8 characters" : ""} />

      {mode === "register" && (
        <label className="text-sm flex flex-col gap-1">
          <span className="text-ink-soft">I am a</span>
          <select value={form.role} onChange={set("role")} className="bg-paper border border-sage-deep rounded-md px-2 py-2">
            <option value="user">Manufacturer / researcher / practitioner</option>
            <option value="facilitator">IP facilitator (answers escalations)</option>
          </select>
        </label>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        onClick={submit}
        disabled={busy || !form.email || !form.password || (mode === "register" && !form.name)}
        className="text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40"
      >
        {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
      </button>

      <div className="flex items-center justify-between text-xs text-ink-soft">
        <button className="underline underline-offset-2" onClick={() => setMode(mode === "login" ? "register" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
        <button className="underline underline-offset-2" onClick={onSkip}>Continue as guest</button>
      </div>
    </div>
  );
}

function Field({ label, hint, ...props }) {
  return (
    <label className="text-sm flex flex-col gap-1">
      <span className="text-ink-soft">{label}</span>
      <input {...props} className="bg-paper border border-sage-deep rounded-md px-3 py-2 focus:border-leaf" />
      {hint && <span className="text-[11px] text-ink-soft">{hint}</span>}
    </label>
  );
}
