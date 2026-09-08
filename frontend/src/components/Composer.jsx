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
    <div className="border-t border-patra-deep bg-patra/95 backdrop-blur px-6 pt-3 pb-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-2.5 text-xs text-ink-soft">
          <Segmented options={["India", "International", "Both"]} value={jurisdiction} onChange={setJurisdiction} />
          <label className="flex items-center gap-1.5">
            Language
            <select value={lang} onChange={(e) => setLang(e.target.value)}
                    className="bg-paper border border-patra-deep rounded-md px-2 py-1 text-ink">
              {LANGS.map(([c, n]) => <option key={c} value={c}>{n}</option>)}
            </select>
          </label>
          {category && (
            <span className="px-2 py-0.5 rounded-full bg-haldi-wash text-[11px] text-[#8a5c07] border border-[#ecd7a8]">
              {category.name}
            </span>
          )}
        </div>

        <div className="flex items-end gap-2 bg-paper border border-patra-deep rounded-2xl pl-4 pr-2 py-2 shadow-[0_1px_2px_rgba(19,32,26,0.04)] focus-within:border-tulsi">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            rows={1}
            placeholder="Ask about patents, licensing, GI, ABS, advertising or export rules…"
            className="flex-1 bg-transparent resize-none outline-none py-1.5 text-[15px] max-h-40 placeholder:text-ink-soft/70"
            onInput={(e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"; }}
          />
          <VoiceButton lang={lang} onResult={(t) => { onChange(t); setTimeout(onSend, 60); }} />
          <button
            onClick={onSend}
            disabled={loading || !value.trim()}
            className="shrink-0 h-9 px-4 rounded-full bg-tulsi text-white text-sm font-semibold hover:bg-tulsi-soft disabled:opacity-35"
          >
            {loading ? "Reading" : "Ask"}
          </button>
        </div>

        <p className="text-[11px] text-ink-soft/80 mt-2 text-center">
          Answers come from cited statutes. This is information, not legal advice.
        </p>
      </div>
    </div>
  );
}
