/**
 * POST /api/translate-jobs
 * Backfill: translate existing jobs in the DB to English (title, company, location, description).
 * Only updates rows where translation actually changed the text.
 */

import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { ensureJobsEnglish } from "@/lib/translate";

export async function POST() {
  try {
    const supabase = getSupabaseServer();
    const { data: jobs, error: fetchError } = await supabase
      .from("jobs")
      .select("id, title, company, location, description");

    if (fetchError) {
      return NextResponse.json(
        { success: false, error: fetchError.message },
        { status: 500 }
      );
    }

    if (!jobs?.length) {
      return NextResponse.json({ success: true, updated: 0, message: "No jobs to translate" });
    }

    const translated = await ensureJobsEnglish(
      jobs.map((j) => ({
        title: String(j.title ?? ""),
        company: String(j.company ?? ""),
        location: j.location ?? null,
        description: j.description ?? null,
      }))
    );

    let updated = 0;
    for (let i = 0; i < jobs.length; i++) {
      const orig = jobs[i];
      const t = translated[i];
      const changed =
        t.title !== (orig.title ?? "") ||
        t.company !== (orig.company ?? "") ||
        t.location !== (orig.location ?? null) ||
        (t.description ?? null) !== (orig.description ?? null);
      if (!changed) continue;

      const { error: updateError } = await supabase
        .from("jobs")
        .update({
          title: t.title,
          company: t.company,
          location: t.location ?? orig.location ?? "",
          description: t.description ?? orig.description,
        })
        .eq("id", orig.id);

      if (!updateError) updated++;
    }

    return NextResponse.json({
      success: true,
      total: jobs.length,
      updated,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
