"use client";

import { useEffect, useState } from "react";
import JobCard from "@/components/JobCard";

type Job = Record<string, unknown>;

export default function JobsClientRecovery() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/jobs?limit=12", { cache: "no-store" });
        const payload = (await response.json()) as { jobs?: Job[]; error?: string };

        if (!response.ok) {
          setError(payload.error || "Could not load jobs from browser.");
          return;
        }

        setJobs(payload.jobs ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load jobs from browser.");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400">
        Retrying from browser...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-700/40 bg-red-950/30 p-12 text-center text-red-200">
        Browser fallback also failed. Please confirm your Mongo connection and refresh.
      </div>
    );
  }

  if (!jobs.length) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-500">
        No jobs available.
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {jobs.map((job) => (
        <li key={String(job.id)}>
          <JobCard job={job} isAdmin={false} />
        </li>
      ))}
    </ul>
  );
}
