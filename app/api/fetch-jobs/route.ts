import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchAllJobSources } from "@/lib/job-sources";
import { ensureJobsEnglish } from "@/lib/translate";

/**
 * GET /api/fetch-jobs
 * Fetches jobs from Remotive, RemoteOK, and ArbeitNow, then upserts into Supabase.
 * Duplicates are skipped (unique on apply_url).
 */
export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const results = await fetchAllJobSources();

    let totalInserted = 0;
    const summary: { source: string; fetched: number; inserted: number; error?: string }[] = [];

    for (const { source, jobs, count, error } of results) {
      if (error) {
        summary.push({ source, fetched: 0, inserted: 0, error });
        continue;
      }

      const filtered = jobs.filter((j) => j.apply_url?.trim());
      const translated = await ensureJobsEnglish(filtered);
      const rows = translated.map((j) => ({
        title: j.title,
        company: j.company,
        location: j.location || "Remote",
        description: j.description,
        apply_url: j.apply_url,
      }));

      if (rows.length === 0) {
        summary.push({ source, fetched: count, inserted: 0 });
        continue;
      }

      const { data, error: upsertError } = await supabase
        .from("jobs")
        .upsert(rows, {
          onConflict: "apply_url",
          ignoreDuplicates: true,
        })
        .select("id");

      if (upsertError) {
        summary.push({ source, fetched: count, inserted: 0, error: upsertError.message });
        continue;
      }

      const inserted = Array.isArray(data) ? data.length : 0;
      totalInserted += inserted;
      summary.push({ source, fetched: count, inserted });
    }

    return NextResponse.json({
      ok: true,
      totalInserted,
      summary,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch jobs";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
