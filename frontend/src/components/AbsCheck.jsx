import { useEffect, useState } from "react";
import { api } from "../api.js";

// ABS (Access and Benefit Sharing) compliance checklist under the Biological Diversity Act.
export default function AbsCheck() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.absQuestions().then(setQuestions).catch(() => {});
  }, []);

  const complete = questions.length > 0 && questions.every((q) => answers[q.id]);

  const submit = async () => setResult(await api.absCheck(answers));

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-ink-soft">
        Using an Indian plant, animal or microbe in your product? Answer these to see whether you need
        NBA approval or State Board intimation, and what benefit-sharing applies.
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
        Check ABS requirements
      </button>

      {result && (
        <div className="border-l-4 border-saffron bg-paper rounded-r-md p-4 flex flex-col gap-3">
          <h3 className="text-xl text-leaf">{result.likely_requirement}</h3>
          <p className="text-sm">{result.summary}</p>

          {result.steps.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-ink-soft mb-1">What to do</div>
              <ol className="list-decimal pl-5 text-sm flex flex-col gap-1">
                {result.steps.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            </div>
          )}

          {result.obligations.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-ink-soft mb-1">Ongoing obligations</div>
              <ul className="list-disc pl-5 text-sm flex flex-col gap-1">
                {result.obligations.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </div>
          )}

          <div className="text-xs text-ink-soft">
            Based on: {result.references.join("; ")}
          </div>
          <div className="text-[11px] text-ink-soft border-t border-sage-deep pt-2">{result.disclaimer}</div>
        </div>
      )}
    </div>
  );
}
