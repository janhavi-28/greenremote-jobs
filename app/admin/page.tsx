"use client";

import Link from "next/link";
import { useState } from "react";

interface BatchResult {
  success: boolean;
  total: number;
  processed: number;
  offset: number;
  nextOffset: number;
  hasMore: boolean;
  updated: number;
  message?: string;
  error?: string;
}

interface Summary {
  total: number;
  processed: number;
  updated: number;
  batches: number;
}

type Status = "idle" | "running" | "done" | "error";

const BATCH_SIZE = 20;

export default function AdminPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [log, setLog] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appendLog = (msg: string) =>
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);

  const runTranslateAll = async () => {
    setStatus("running");
    setLog([]);
    setSummary(null);
    setErrorMsg(null);

    let offset = 0;
    let hasMore = true;
    let totalJobs = 0;
    let totalProcessed = 0;
    let totalUpdated = 0;
    let batches = 0;

    appendLog("Starting bulk translation...");

    while (hasMore) {
      try {
        const res = await fetch(
          `/api/translate-jobs?offset=${offset}&batch=${BATCH_SIZE}`,
          { method: "POST" },
        );

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`HTTP ${res.status}: ${text}`);
        }

        const data: BatchResult = await res.json();

        if (!data.success) {
          throw new Error(data.error ?? "Unknown error from API");
        }

        totalJobs = data.total;
        totalProcessed += data.processed;
        totalUpdated += data.updated;
        batches++;
        hasMore = data.hasMore;
        offset = data.nextOffset;

        if (data.processed === 0) {
          appendLog("No more jobs to translate.");
          break;
        }

        appendLog(
          `Batch ${batches}: offset ${data.offset} -> processed ${data.processed}, updated ${data.updated} / ${data.total} total`,
        );

        if (hasMore) await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appendLog(`ERROR: ${msg}`);
        setErrorMsg(msg);
        setStatus("error");
        return;
      }
    }

    setSummary({ total: totalJobs, processed: totalProcessed, updated: totalUpdated, batches });
    appendLog(`Done. Translated ${totalUpdated} of ${totalProcessed} processed jobs.`);
    setStatus("done");
  };

  return (
    <div className="min-h-screen bg-zinc-950 px-4 py-10">
      <div className="max-w-2xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Admin Panel</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Bulk operations for the Mongo Atlas jobs database.
          </p>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">
              Translate All Jobs to English
            </h2>
            <p className="text-sm text-zinc-400 mt-1">
              Fetches jobs in batches of {BATCH_SIZE} and translates title, company,
              location, and description to English using MyMemory API.
            </p>
          </div>

          <button
            id="btn-translate-all"
            onClick={runTranslateAll}
            disabled={status === "running"}
            className="rounded-lg bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-500 disabled:opacity-50 disabled:pointer-events-none transition"
          >
            {status === "running" ? "Translating..." : "Translate All Jobs"}
          </button>

          {summary && status === "done" && (
            <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/30 p-4 text-sm text-emerald-300 space-y-1">
              <p className="font-semibold text-emerald-200">Translation complete</p>
              <p>Total jobs in DB: <strong>{summary.total}</strong></p>
              <p>Jobs processed: <strong>{summary.processed}</strong></p>
              <p>Jobs updated: <strong>{summary.updated}</strong></p>
              <p>Batches run: <strong>{summary.batches}</strong></p>
            </div>
          )}

          {errorMsg && status === "error" && (
            <div className="rounded-lg border border-red-700/40 bg-red-950/30 p-4 text-sm text-red-300">
              <p className="font-semibold text-red-200">Error</p>
              <p className="mt-1 font-mono break-all">{errorMsg}</p>
            </div>
          )}

          {log.length > 0 && (
            <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4 max-h-72 overflow-y-auto">
              <p className="text-xs text-zinc-500 mb-2 uppercase font-semibold tracking-wide">
                Live log
              </p>
              {log.map((line, i) => (
                <p
                  key={i}
                  className={`text-xs font-mono leading-relaxed ${
                    line.includes("ERROR")
                      ? "text-red-400"
                      : line.includes("Done")
                        ? "text-emerald-400"
                        : "text-zinc-300"
                  }`}
                >
                  {line}
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-100">Other Actions</h2>
          <div className="flex flex-wrap gap-3">
            <a
              href="/api/fetch-jobs"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition"
            >
              Run Jobs_Scraper import
            </a>
            <Link
              href="/jobs"
              className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 transition"
            >
              View Jobs Board
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
