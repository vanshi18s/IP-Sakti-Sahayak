import { useEffect, useRef, useState } from "react";

// Browser speech-to-text (Web Speech API). Works in Chrome/Edge; hidden elsewhere.
const LANG_MAP = {
  auto: "hi-IN", en: "en-IN", hi: "hi-IN", mr: "mr-IN", ta: "ta-IN", te: "te-IN",
  kn: "kn-IN", ml: "ml-IN", bn: "bn-IN", gu: "gu-IN",
};

export default function VoiceButton({ lang, onResult }) {
  const [listening, setListening] = useState(false);
  const recRef = useRef(null);
  const Speech = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => () => recRef.current?.stop(), []);

  if (!Speech) return null;

  const toggle = () => {
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Speech();
    rec.lang = LANG_MAP[lang] || "en-IN";
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => onResult(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      title={listening ? "Stop listening" : "Speak your question"}
      className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
        listening ? "bg-saffron border-saffron text-paper animate-pulse" : "bg-paper border-sage-deep text-leaf hover:border-leaf"
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
      </svg>
    </button>
  );
}
