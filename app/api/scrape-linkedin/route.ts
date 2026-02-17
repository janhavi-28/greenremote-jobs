/**
 * API route: POST/GET /api/scrape-linkedin
 * Calls the LinkedIn scraper and returns inserted/updated count.
 * Server-side only. Does not modify any existing app logic.
 */

import { NextResponse } from "next/server";
import { scrapeAndInsertLinkedInJobs } from "@/lib/scrapers/linkedinScraper";

export async function GET() {
  return runScrape();
}

export async function POST() {
  return runScrape();
}

async function runScrape() {
  try {
    const { fetched, inserted } = await scrapeAndInsertLinkedInJobs();
    return NextResponse.json({ success: true, fetched, inserted });
  } catch (e) {
    const message = e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
