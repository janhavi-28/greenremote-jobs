import { NextResponse } from "next/server";
import { runJobsScraper } from "@/lib/jobs-scraper";

export const runtime = "nodejs";

export async function GET() {
  try {
    const scraperResult = await runJobsScraper("all");

    return NextResponse.json({
      ok: true,
      fetched: scraperResult.total,
      inserted: scraperResult.inserted,
      matched: scraperResult.matched,
      modified: scraperResult.modified,
      snapshotFile: scraperResult.snapshot_file ?? null,
      sourceFiles: scraperResult.source_files ?? {},
      scrapers: scraperResult.scrapers,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run Jobs_Scraper import";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
