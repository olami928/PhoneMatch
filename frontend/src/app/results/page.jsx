// /results — where the questionnaire sends the shopper.
//
// HONESTY NOTE (D24): the model service is not deployed yet (step M7), so this
// page does NOT show a ranked list. Showing invented recommendations would be
// the single most misleading thing this project could do, because the whole
// promise is that the model picked the phone. Instead it shows exactly what the
// shopper answered, confirms the answers reached the backend, and points at the
// catalog. When M7 lands, only the middle block of this file changes.
//
// The answers are echoed back in the URL rather than stored server-side, because
// the model is not called yet. There is no database until Stage 3.

import Link from "next/link";
import SiteHeader from "../../components/SiteHeader";
import { fetchQuestionnaire } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ searchParams }) {
  const params = (await searchParams) || {};

  // Only the five known question ids are shown, in the config's order, so a
  // crafted link cannot make this page display arbitrary text as an answer.
  let questions = [];
  try {
    questions = (await fetchQuestionnaire()).questions || [];
  } catch {
    questions = [];
  }

  const answered = questions
    .map((q) => ({ question: q.question, answer: params[q.id] }))
    .filter((row) => row.answer);

  return (
    <>
      <SiteHeader />

      <main className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900">Your answers</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Here is what you told us. Change any answer and run it again at any time.
        </p>

        <dl className="mt-5 divide-y divide-zinc-100 rounded-lg border border-zinc-200">
          {answered.map((row) => (
            <div key={row.question} className="flex justify-between gap-4 p-3">
              <dt className="text-sm text-zinc-600">{row.question}</dt>
              <dd className="text-sm font-medium text-zinc-900">{row.answer}</dd>
            </div>
          ))}
        </dl>

        {/* This block is replaced when the model service is deployed at M7. */}
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            Recommendations are not available yet
          </p>
          <p className="mt-1 text-sm text-amber-800">
            Our model service is still being deployed, so we cannot rank phones for
            you at the moment. We would rather tell you that than show you a made-up
            list.
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/phones"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-medium text-white hover:bg-zinc-700"
          >
            Browse phones that fit your budget
          </Link>
          <Link
            href="/find"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-center text-sm font-medium text-zinc-800 hover:bg-zinc-50"
          >
            Change my answers
          </Link>
        </div>
      </main>
    </>
  );
}
