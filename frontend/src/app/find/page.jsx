// /find — the questionnaire (D20, D21).
//
// It is a SERVER component only to fetch the questions. The questions
// themselves come from the backend, which reads the frozen config
// (model/config/questionnaire_v1.json). Nothing about the wording is written in
// this file, so the team can reword a question without touching any code.
//
// ONE QUESTION PER SCREEN with a progress bar and a Back button, as specified in
// AGENTS.md section 10. Five screens of one question each is the whole flow, and
// it must never become six (D21).

import { fetchQuestionnaire } from "../../lib/api";
import Questionnaire from "../../components/Questionnaire";
import SiteHeader from "../../components/SiteHeader";

export const dynamic = "force-dynamic";

export default async function FindPage() {
  let questions = [];
  let loadError = null;

  try {
    const data = await fetchQuestionnaire();
    questions = data.questions || [];
  } catch (error) {
    loadError = error.message;
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-8">
        {loadError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">We could not load the questions.</p>
            <p className="mt-1">{loadError}</p>
            <p className="mt-2">
              You can still{" "}
              <a href="/phones" className="underline">
                browse all phones
              </a>
              .
            </p>
          </div>
        ) : (
          <Questionnaire questions={questions} />
        )}
      </main>
    </>
  );
}
