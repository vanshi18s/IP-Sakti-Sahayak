import { useEffect, useRef } from "react";
import AnswerMessage from "./AnswerMessage.jsx";

const STARTERS = [
  "Can a classical Ayurvedic formulation be patented in India?",
  "Do I need NBA approval to use an Indian medicinal plant commercially?",
  "Can I advertise my Ayurvedic product as a cure for diabetes?",
  "How do I file one patent application covering many countries?",
];

export default function Thread({ messages, onStarter }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center text-center py-10">
        <div className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-tulsi/10 bg-[#edf5e9] shadow-[0_20px_50px_rgba(27,67,50,0.10)]">
          <div className="absolute inset-0 bg-gradient-to-r from-[#f9fbf3] via-[#f9fbf3]/90 to-transparent" />
          <img
            src="/images/ayurveda-herbs.jpg"
            alt="Traditional Ayurvedic herbs, spices, and a mortar and pestle"
            className="absolute inset-y-0 right-0 h-full w-[42%] object-cover opacity-90"
          />
          <div className="relative z-10 max-w-xl px-7 py-10 text-left sm:max-w-[58%] sm:px-12 sm:py-12">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.22em] text-tulsi/70">
              <img src="/leaf.svg" alt="" className="h-6 w-6" /> Ayurveda &amp; intellectual property
            </div>
            <h2 className="hero-heading text-[46px] sm:text-[58px] leading-[0.95] text-tulsi mt-5">
              Ask IP-SAKTI Sahayak
            </h2>
            <p className="mt-4 max-w-md text-[14px] leading-relaxed text-ink-soft sm:text-[15px]">
              about patentability, prior art, or regulatory/ABS guidance for your Ayurveda product or formulation — in text or voice, in Hindi, English, and regional languages.
            </p>
          </div>
        </div>

        {/* Starters sit along a stem, like leaves */}
        <div className="relative mt-8 w-full max-w-2xl">
          <span className="absolute left-1/2 -translate-x-px top-0 bottom-0 w-px bg-sprout/45" aria-hidden="true" />
          <ol className="relative flex flex-col gap-3">
            {STARTERS.map((s, i) => (
              <li key={s} className={i % 2 ? "self-center md:-translate-x-6" : "self-center md:translate-x-6"}>
                <button
                  onClick={() => onStarter(s)}
                  className="group flex items-center gap-2.5 bg-paper border border-patra-deep rounded-full pl-4 pr-5 py-3
                             text-[14px] text-ink shadow-[0_1px_3px_rgba(19,32,26,0.06)]
                             hover:border-tulsi hover:shadow-[0_2px_10px_rgba(27,67,50,0.10)] transition"
                >
                  <LeafGlyph />
                  <span className="text-left">{s}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8 py-7">
      {messages.map((m) =>
        m.role === "user" ? (
          <div key={m.id} className="flex justify-end">
            <div className="max-w-[78%] bg-tulsi text-white rounded-2xl rounded-br-md px-4 py-2.5">
              <p className="text-[15px] leading-relaxed">{m.text}</p>
            </div>
          </div>
        ) : m.panels ? (
          <div key={m.id} className="flex flex-col gap-6">
            <div className="grid md:grid-cols-2 gap-6">
              {m.panels.map((p) => <AnswerMessage key={p.id} msg={p} />)}
            </div>
            {m.differences !== undefined && (
              <div className="border-l-2 border-haldi pl-4">
                <h3 className="text-[15px] text-tulsi">Where the two regimes differ</h3>
                <p className="answer text-[15px] mt-1 whitespace-pre-wrap">
                  {m.differences || "Comparing the two answers…"}
                </p>
              </div>
            )}
          </div>
        ) : (
          <AnswerMessage key={m.id} msg={m} />
        )
      )}
      <div ref={end} />
    </div>
  );
}

function LeafGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0">
      <path d="M14 2C7 2 2 6 2 11c0 1.4.4 2.6 1.1 3.6C4.6 9.4 8 5.8 13 4c-4 2.6-6.6 6-7.6 10.4.9.4 1.9.6 3 .6 3.6 0 5.6-3 5.6-13z"
            fill="#7fa383" />
    </svg>
  );
}

// Empty-state mark: one tulsi sprig, breathing slowly.
function Sprig() {
  return (
    <svg width="128" height="128" viewBox="0 0 96 96" fill="none" aria-hidden="true"
         className="origin-bottom [animation:sway_7s_ease-in-out_infinite] motion-reduce:animate-none">
      <style>{`@keyframes sway{0%,100%{transform:rotate(-1.2deg)}50%{transform:rotate(1.2deg)}}`}</style>
      <path d="M48 90V28" stroke="#7fa383" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M48 62c-14 0-24-9-26-22 14-2 24 6 26 22zM48 62c14 0 24-9 26-22-14-2-24 6-26 22z"
            fill="#e8efe7" stroke="#7fa383" strokeWidth="1.3" />
      <path d="M48 40c-10 0-17-6-18-16 10-1 17 4 18 16zM48 40c10 0 17-6 18-16-10-1-17 4-18 16z"
            fill="#f0f4ee" stroke="#7fa383" strokeWidth="1.3" />
      <circle cx="48" cy="20" r="4.5" fill="#c8860d" opacity=".55" />
    </svg>
  );
}
