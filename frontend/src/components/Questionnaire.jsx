"use client";

// Questionnaire walks the shopper through the five questions, one per screen.
//
// Design rules this implements (AGENTS.md section 10):
//  - one question per screen, with a progress bar and a Back button
//  - a Skip on the optional question only
//  - budget uses preset ranges, never free typing (D21, and the usability finding)
//  - no personal information is ever asked
//
// WHY THE ANSWERS ARE NOT SENT ANYWHERE YET: the recommendation call needs the
// Python model service (M7). On the last question we store the answers in the
// URL and go to the results screen, which shows an honest "not connected yet"
// message rather than a fake ranked list. D24 forbids claiming the model does
// something it does not currently do, so the placeholder states the truth.

import { useState } from "react";
import { useRouter } from "next/navigation";

const STORAGE_KEY = "phonematch.answers.v1";

export default function Questionnaire({ questions }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  if (!questions || questions.length === 0) {
    return (
      <p className="rounded-lg border border-zinc-200 p-6 text-center text-sm text-zinc-600">
        The questionnaire is not available right now. Please browse all phones instead.
      </p>
    );
  }

  const question = questions[step];
  const total = questions.length;
  const isLast = step === total - 1;
  const selected = answers[question.id];

  // Whether the main action button is shown.
  //  - Not the last question, nothing chosen yet  -> "Next" (lets a shopper
  //    who wants to read the options move on without picking).
  //  - Last question, something chosen            -> "See my phones", the only
  //    way to finish. Skipping the brand would also finish, but it discards
  //    the choice, so it must not be the only way out.
  const showAction = isLast ? Boolean(selected) : !selected;

  function choose(option) {
    const next = { ...answers, [question.id]: option.label };
    setAnswers(next);

    // Move on immediately on a single-choice question. Making someone press
    // Next as well is a pointless extra tap, and on mobile it is the most
    // common reason a form feels slow.
    if (!isLast) {
      setStep(step + 1);
    }
  }

  function goBack() {
    if (step === 0) {
      router.push("/");
      return;
    }
    setStep(step - 1);
  }

  function skip() {
    const next = { ...answers };
    delete next[question.id];
    setAnswers(next);
    if (isLast) finish(next);
    else setStep(step + 1);
  }

  function finish(finalAnswers) {
    // Keep the answers so the results page can show what was asked, and so the
    // shopper can come back and change one answer without starting over
    // (feature 12 in AGENTS.md section 6).
    try {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(finalAnswers));
    } catch {
      // Storage unavailable: the answers still travel in the URL below.
    }
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(finalAnswers)) {
      params.set(key, value);
    }
    router.push(`/results?${params.toString()}`);
  }

  function next() {
    if (isLast) finish(answers);
    else setStep(step + 1);
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-lg shadow-slate-200/60 sm:p-7">
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Question {question.number} of {total}
          </span>
          <span className="font-medium text-slate-800">{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="Questionnaire progress"
          className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">
          Smart match
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {question.question}
        </h1>
        {question.help && <p className="mt-2 text-sm text-slate-600">{question.help}</p>}
      </div>

      <fieldset className="mt-5">
        <legend className="sr-only">{question.question}</legend>
        <div className="space-y-2.5">
          {question.options.map((option) => {
            const isSelected = selected === option.label;
            return (
              <label
                key={option.label}
                className={
                  isSelected
                    ? "flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-blue-600 bg-blue-50 p-3.5 shadow-sm shadow-blue-100"
                    : "flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-3.5 transition hover:border-slate-300 hover:bg-white"
                }
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.label}
                  checked={isSelected}
                  onChange={() => choose(option)}
                  className="h-4 w-4 accent-blue-600"
                />
                <span className="text-sm font-medium text-slate-800">{option.label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-7 flex items-center gap-3">
        <button
          onClick={goBack}
          className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {showAction && (
          <button
            onClick={next}
            className="ml-auto rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm shadow-slate-900/10 transition hover:bg-blue-700"
          >
            {isLast ? "See my phones" : "Next"}
          </button>
        )}

        {question.skippable && (
          <button
            onClick={skip}
            className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
}
