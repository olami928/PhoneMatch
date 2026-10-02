// /results — the ranked phones the model picked.
//
// This page is a server component on purpose. The shopper sees real model
// output in the first HTML response, with no loading spinner and no chance of
// showing placeholder phones that are not recommendations.
//
// SECONDS MATTER HERE: a shopper who answers five questions wants an answer
// fast. The model service keeps the forest warm in memory (D35), so a request
// is a few hundred milliseconds, not the 5.5s cold load.

import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import ResultList from "../../components/ResultList";
import { fetchQuestionnaire, postRecommendWithRetry } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }) {
  const params = (await searchParams) || {};

  // Only the five known question ids are used, in the config's own order. A
  // crafted link cannot make this page display arbitrary text as an answer or
  // pass unknown fields to the model.
  let questions = [];
  try {
    questions = (await fetchQuestionnaire()).questions || [];
  } catch {
    questions = [];
  }

  const answers = {};
  for (const q of questions) {
    const value = params[q.id];
    if (value) answers[q.id] = value;
  }

  const answered = questions
    .map((q) => ({ question: q.question, answer: answers[q.id] }))
    .filter((row) => row.answer);

  // Not enough answers to run the model. Send them back to the questionnaire
  // rather than showing an empty results page.
  if (answered.length < 4) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="text-2xl font-semibold text-zinc-900">
            We need a few more answers
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Answer the questions and we will pick a phone for you.
          </p>
          <Link
            href="/find"
            className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
          >
            Start the questions
          </Link>
        </main>
      </>
    );
  }

  // The one call that produces the whole point of this project.
  //
  // Uses the retrying wrapper rather than the plain call, because the model runs
  // on free hosting that sleeps when idle. A shopper who arrives just after it
  // went to sleep would otherwise see an error page; with the retry the page
  // takes a few seconds longer and then shows their recommendations.
  let result = null;
  let error = null;
  try {
    result = await postRecommendWithRetry(answers);
  } catch (err) {
    error = err.message;
  }

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="rounded-[28px] border border-slate-200 bg-white/85 p-5 shadow-lg shadow-slate-200/60 sm:p-7">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-strong">
                Recommended for you
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                Your top picks
              </h1>
            </div>
            <Link
              href="/find"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              Change my answers
            </Link>
          </div>

          <p className="mt-3 text-sm text-slate-600">
            Picked from our catalog by matching your answers to each phone&apos;s specs.
          </p>
        </div>

        {error ? (
          <div className="mt-6 rounded-[24px] border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <p className="font-semibold text-amber-900">We could not reach our model just now</p>
            <p className="mt-1 text-sm text-amber-800">{error}</p>
            <Link
              href="/find"
              className="mt-4 inline-block text-sm font-medium text-amber-900 underline underline-offset-4"
            >
              Try again
            </Link>
          </div>
        ) : (
          <ResultList result={result} />
        )}

        <div className="mt-8 rounded-[24px] border border-slate-200 bg-white/85 p-5 shadow-sm shadow-slate-200/50">
          <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-slate-500">
            Your answers
          </h2>
          <dl className="mt-3 divide-y divide-slate-100">
            {answered.map((row) => (
              <div key={row.question} className="flex justify-between gap-4 py-3">
                <dt className="text-sm text-slate-600">{row.question}</dt>
                <dd className="text-right text-sm font-medium text-slate-900">{row.answer}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/find"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              Change my answers
            </Link>
            <Link
              href="/phones"
              className="rounded-full text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Browse all phones
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
