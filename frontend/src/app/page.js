"use client";

import { useCallback, useEffect, useState } from "react";

// Where the backend lives. Set in frontend/.env.local while developing, and in
// Vercel's environment settings once the backend is deployed.
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export default function Home() {
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const loadHello = useCallback(async () => {
    setStatus("loading");
    setErrorMessage("");
    try {
      const response = await fetch(`${API_URL}/hello`);
      if (!response.ok) {
        throw new Error(`The backend answered with status ${response.status}.`);
      }
      const body = await response.json();
      setData(body);
      setStatus("ok");
    } catch (error) {
      setErrorMessage(error.message || "Could not reach the backend.");
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    loadHello();
  }, [loadHello]);

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-10 font-sans dark:bg-black">
      <main className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
          Phone shop
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Stage 1 check: the frontend and backend are connected.
        </p>

        <section className="mt-8 rounded-lg border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            Message from the backend
          </h2>

          {status === "loading" && (
            <p className="mt-3 text-base text-zinc-700 dark:text-zinc-300">
              Loading...
            </p>
          )}

          {status === "ok" && data && (
            <div className="mt-3">
              <p className="text-lg font-medium text-black dark:text-zinc-50">
                {data.message}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                service: {data.service} · time: {data.time}
              </p>
            </div>
          )}

          {status === "error" && (
            <div className="mt-3">
              <p className="text-base text-red-600 dark:text-red-400">
                Could not reach the backend.
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Is it running at {API_URL}? Start it with{" "}
                <code className="rounded bg-black/[.06] px-1 py-0.5 font-mono dark:bg-white/[.08]">
                  cd backend &amp;&amp; npm run dev
                </code>
              </p>
              <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                {errorMessage}
              </p>
              <button
                onClick={loadHello}
                className="mt-3 rounded bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:opacity-90"
              >
                Try again
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

