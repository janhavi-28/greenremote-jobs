import { NextResponse } from "next/server";
import { runJobsScraper } from "@/lib/jobs-scraper";

export const runtime = "nodejs";

export async function GET() {
  return runScrape();
}

export async function POST() {
  return runScrape();
}

async function runScrape() {
  try {
    const scraperResult = await runJobsScraper("linkedin");

    return NextResponse.json({
      success: true,
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
      error instanceof Error ? error.message : "Failed to scrape LinkedIn jobs";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
