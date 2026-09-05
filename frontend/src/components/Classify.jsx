import { useEffect, useState } from "react";
import { api } from "../api.js";

// Three-question flow that tells the user what their product legally is.
export default function Classify({ onDone }) {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.classifyQuestions().then(setQuestions).catch(() => {});
  }, []);

  const complete = questions.length > 0 && questions.every((q) => answers[q.id]);

  const submit = async () => {
    const r = await api.classify(answers);
    setResult(r);
    onDone?.(r);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Answer three questions and we'll tell you which legal category your product falls in. That decides
        which IP and licensing rules apply.
      </p>

      {questions.map((q, idx) => (
        <fieldset key={q.id} className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-ink">
            {idx + 1}. {q.text}
          </legend>
          <div className="flex flex-wrap gap-2">
            {q.options.map((o) => (
              <label
                key={o}
                className={`text-sm px-3 py-1.5 rounded-md border cursor-pointer ${
                  answers[q.id] === o ? "bg-leaf text-paper border-leaf" : "bg-paper border-sage-deep hover:border-leaf"
                }`}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={o}
                  className="sr-only"
                  checked={answers[q.id] === o}
                  onChange={() => setAnswers({ ...answers, [q.id]: o })}
                />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        onClick={submit}
        disabled={!complete}
        className="self-start text-sm font-semibold px-4 py-2 rounded-md bg-leaf text-paper disabled:opacity-40"
      >
        Classify my product
      </button>

      {result && (
        <div className="border-l-4 border-saffron bg-paper rounded-r-md p-4 flex flex-col gap-3">
          <h3 className="text-xl text-leaf">{result.name}</h3>
          <Row label="Regulatory pathway" text={result.regulatory} />
          <Row label="IP posture" text={result.ip} />
          <Row label="Biodiversity / ABS" text={result.abs} />
        </div>
      )}
    </div>
  );
}

function Row({ label, text }) {
  return (
    <div>
      <div className="text-xs font-semibold text-ink-soft">{label}</div>
      <p className="text-sm leading-relaxed">{text}</p>
    </div>
  );
}
