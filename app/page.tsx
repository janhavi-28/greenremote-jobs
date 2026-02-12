"use client";

import { useEffect, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";

export default function JobsPage() {
  const supabase = getSupabaseClient();  // ← THIS WAS MISSING

  const [jobs, setJobs] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    fetchJobs();
    getUser();
  }, []);

  const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    setUser(data.user);
  };

  const fetchJobs = async () => {
    const { data, error } = await supabase
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error) setJobs(data || []);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("jobs")
      .delete()
      .eq("id", id);

    if (!error) {
      setJobs((prev) => prev.filter((job) => job.id !== id));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-zinc-100">GreenRemote Jobs</h1>
          <a
            href="/jobs"
            className="inline-flex items-center rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
          >
            Browse all jobs with filters →
          </a>
        </div>
        <ul className="space-y-4">
          {jobs.map((job) => (
            <li key={job.id}>
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold text-cyan-400">
                  {(job.title || "")
                    .replace(/\s*\([mwd]\/[mwd]\/[mwd]\)\s*/gi, " ")
                    .replace(/\s+/g, " ")
                    .trim() || job.title}
                </h2>
                  <p className="text-sm text-zinc-400 mt-1">{job.company} · {job.location}</p>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={job.apply_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-500"
                  >
                    Apply
                  </a>
                  {user && (
                    <button
                      onClick={() => handleDelete(job.id)}
                      className="text-sm text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}