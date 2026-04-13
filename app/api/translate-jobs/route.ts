import { NextRequest, NextResponse } from "next/server";
import { ensureJobsEnglish } from "@/lib/translate";
import { countJobs, getJobsBatch, updateJobById } from "@/lib/jobs";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
    const batch = Math.min(Math.max(1, Number(searchParams.get("batch")) || 30), 100);
    const total = await countJobs();

    if (total === 0 || offset >= total) {
      return NextResponse.json({
        success: true,
        total,
        processed: 0,
        offset,
        nextOffset: offset,
        hasMore: false,
        updated: 0,
        message: "No jobs to translate",
      });
    }

    const chunk = await getJobsBatch(offset, batch);
    if (!chunk.length) {
      return NextResponse.json({
        success: true,
        total,
        processed: 0,
        offset,
        nextOffset: offset,
        hasMore: false,
        updated: 0,
        message: "No jobs to translate",
      });
    }

    const translated = await ensureJobsEnglish(
      chunk.map((job) => ({
        title: String(job.title ?? ""),
        company: String(job.company ?? ""),
        location: job.location ?? null,
        description: job.description ?? null,
      })),
    );

    let updated = 0;
    for (let i = 0; i < chunk.length; i++) {
      const orig = chunk[i];
      const t = translated[i];
      const changed =
        t.title !== (orig.title ?? "") ||
        t.company !== (orig.company ?? "") ||
        t.location !== (orig.location ?? null) ||
        (t.description ?? null) !== (orig.description ?? null);
      if (!changed) continue;

      const saved = await updateJobById(orig.id, {
        title: t.title,
        company: t.company,
        location: t.location ?? orig.location ?? "Remote",
        description: t.description ?? orig.description,
      });

      if (saved) updated++;
    }

    return NextResponse.json({
      success: true,
      total,
      processed: chunk.length,
      offset,
      nextOffset: offset + chunk.length,
      hasMore: offset + chunk.length < total,
      updated,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
