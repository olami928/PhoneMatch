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
    <div>
      {/* Progress. aria attributes so a screen reader announces the position. */}
      <div className="mb-6">
        <div className="flex items-center justify-between text-sm text-zinc-600">
          <span>
            Question {question.number} of {total}
          </span>
          <span>{Math.round(((step + 1) / total) * 100)}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={step + 1}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-label="Questionnaire progress"
          className="mt-2 h-2 w-full rounded-full bg-zinc-200"
        >
          <div
            className="h-2 rounded-full bg-zinc-900 transition-all"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <h1 className="text-2xl font-semibold text-zinc-900">{question.question}</h1>
      {question.help && <p className="mt-1 text-sm text-zinc-600">{question.help}</p>}

      <fieldset className="mt-5">
        <legend className="sr-only">{question.question}</legend>
        <div className="space-y-2">
          {question.options.map((option) => {
            const isSelected = selected === option.label;
            return (
              <label
                key={option.label}
                className={
                  isSelected
                    ? "flex cursor-pointer items-center gap-3 rounded-lg border-2 border-zinc-900 bg-zinc-50 p-3"
                    : "flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-300 p-3 hover:bg-zinc-50"
                }
              >
                <input
                  type="radio"
                  name={question.id}
                  value={option.label}
                  checked={isSelected}
                  onChange={() => choose(option)}
                  className="h-4 w-4 accent-zinc-900"
                />
                <span className="text-sm font-medium text-zinc-900">
                  {option.label}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={goBack}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50"
        >
          {step === 0 ? "Cancel" : "Back"}
        </button>

        {/* Next is only needed when nothing is picked yet, or after using Skip. */}
        {!isLast && !selected && (
          <button
            onClick={next}
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Next
          </button>
        )}

        {question.skippable && (
          <button
            onClick={skip}
            className="px-2 py-2.5 text-sm text-zinc-600 underline hover:text-zinc-900"
          >
            Skip this question
          </button>
        )}
      </div>
    </div>
  );
}
