/**
 * GET /api/fetch-jobs-extra
 * Fetches jobs from Jobicy API and upserts into Supabase (same jobs table).
 * Use this in addition to /api/fetch-jobs and /api/scrape-linkedin to increase total job count.
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { fetchJobicyJobs } from "@/lib/sources/jobicy";
import { ensureJobsEnglish } from "@/lib/translate";

export async function GET() {
  try {
    const jobs = await fetchJobicyJobs();
    const filtered = jobs.filter((j) => j.apply_url?.trim());
    if (filtered.length === 0) {
      return NextResponse.json({
        ok: true,
        source: "jobicy",
        fetched: 0,
        inserted: 0,
      });
    }

    const translated = await ensureJobsEnglish(filtered);
    const rows = translated.map((j) => ({
      title: j.title,
      company: j.company,
      location: j.location || "Remote",
      description: j.description,
      apply_url: j.apply_url,
    }));

    const supabase = getSupabaseServer();
    const { data, error } = await supabase
      .from("jobs")
      .upsert(rows, { onConflict: "apply_url", ignoreDuplicates: true })
      .select("id");

    if (error) {
      return NextResponse.json(
        { ok: false, source: "jobicy", error: error.message },
        { status: 500 }
      );
    }

    const inserted = Array.isArray(data) ? data.length : 0;
    return NextResponse.json({
      ok: true,
      source: "jobicy",
      fetched: filtered.length,
      inserted,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to fetch Jobicy jobs";
    return NextResponse.json(
      { ok: false, source: "jobicy", error: message },
      { status: 500 }
    );
  }
}
