import VoiceButton from "./VoiceButton.jsx";
import Segmented from "./Segmented.jsx";

const LANGS = [
  ["auto", "Auto"], ["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"], ["ta", "தமிழ்"],
  ["te", "తెలుగు"], ["kn", "ಕನ್ನಡ"], ["ml", "മലയാളം"], ["bn", "বাংলা"], ["gu", "ગુજરાતી"],
];

export default function Composer({
  value, onChange, onSend, loading,
  jurisdiction, setJurisdiction, lang, setLang, category,
}) {
  return (
    <div className="sticky bottom-0 bg-patra/95 backdrop-blur border-t border-patra-deep pt-3 pb-4">
      <div className="max-w-4xl mx-auto px-5">
        <div className="flex flex-wrap items-center gap-3 mb-2 text-xs text-ink-soft">
          <Segmented options={["India", "International", "Both"]} value={jurisdiction} onChange={setJurisdiction} />
          <label className="flex items-center gap-1.5">
            Language
            <select value={lang} onChange={(e) => setLang(e.target.value)}
                    className="bg-paper border border-patra-deep rounded-md px-2 py-1 text-ink">
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          {category && <span className="text-haldi">Product: {category.name}</span>}
        </div>

        <div className="flex items-end gap-2 bg-paper border border-patra-deep rounded-2xl px-3 py-2 focus-within:border-tulsi">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
            }}
            rows={1}
            placeholder="Ask about patents, licensing, GI, ABS, advertising or export rules…"
            className="flex-1 bg-transparent resize-none outline-none py-1.5 text-[15px] max-h-40"
            style={{ height: "auto" }}
            onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
          />
          <VoiceButton lang={lang} onResult={(t) => { onChange(t); setTimeout(onSend, 60); }} />
          <button
            onClick={onSend}
            disabled={loading || !value.trim()}
            className="shrink-0 h-9 px-4 rounded-full bg-tulsi text-patra text-sm font-semibold disabled:opacity-40"
          >
            {loading ? "Reading…" : "Ask"}
          </button>
        </div>

        <p className="text-[11px] text-ink-soft mt-2 text-center">
          Information drawn from cited statutes, not legal advice. Verify with the source or an IP professional.
        </p>
      </div>
    </div>
  );
}
