import { useEffect, useRef } from "react";
import AnswerMessage from "./AnswerMessage.jsx";

const STARTERS = [
  "Can a classical Ayurvedic formulation be patented in India?",
  "Do I need NBA approval to use an Indian medicinal plant commercially?",
  "Can I advertise my Ayurvedic product as a cure for diabetes?",
  "How do I file one patent application covering many countries?",
];

export default function Thread({ messages, onStarter, corpusCount }) {
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 gap-7">
        <Sprig />
        <div>
          <h2 className="text-[26px] text-tulsi leading-tight">What does the law say about your product?</h2>
          <p className="text-[13.5px] text-ink-soft mt-2.5 max-w-md mx-auto leading-relaxed">
            Ask in Hindi, English or any Indian language. Every answer names the Act and section it came from
            {corpusCount ? `, drawn from ${corpusCount.toLocaleString("en-IN")} passages of the statutes themselves` : ""}.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 max-w-2xl">
          {STARTERS.map((s) => (
            <button key={s} onClick={() => onStarter(s)}
                    className="text-[12.5px] px-3.5 py-2 rounded-full border border-patra-deep bg-paper text-ink-soft hover:border-tulsi hover:text-tulsi transition-colors">
              {s}
            </button>
          ))}
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

// Empty-state mark: a single tulsi sprig, drawn once.
function Sprig() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden="true">
      <path d="M48 88V30" stroke="#7fa383" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M48 60c-13 0-22-8-24-20 13-2 22 6 24 20zM48 60c13 0 22-8 24-20-13-2-22 6-24 20z"
            fill="#e6ede6" stroke="#7fa383" strokeWidth="1.2" />
      <path d="M48 40c-9 0-16-6-17-15 9-1 16 4 17 15zM48 40c9 0 16-6 17-15-9-1-16 4-17 15z"
            fill="#eef2ea" stroke="#7fa383" strokeWidth="1.2" />
      <circle cx="48" cy="22" r="4" fill="#c8860d" opacity=".5" />
    </svg>
  );
}
