/**
 * LinkedIn jobs scraper – fetches remote jobs and upserts into Supabase.
 * Isolated module: does not modify any existing app logic.
 */

import { getSupabaseServer } from "@/lib/supabase";
import { ensureJobsEnglish } from "@/lib/translate";

export interface LinkedInJobRow {
  title: string;
  company: string;
  location: string;
  description: string;
  apply_url: string;
}

export interface ScrapeResult {
  fetched: number;
  inserted: number;
}

/**
 * Fetches LinkedIn jobs via @atharvh01/linkedin-jobs-api and upserts into public.jobs.
 * Uses conflict on apply_url (same as other job sources).
 */
export async function scrapeAndInsertLinkedInJobs(): Promise<ScrapeResult> {
  const jobs = await fetchLinkedInJobs();
  if (jobs.length === 0) return { fetched: 0, inserted: 0 };

  const translated = await ensureJobsEnglish(jobs);
  const supabase = getSupabaseServer();
  const rows: LinkedInJobRow[] = translated.map((j) => ({
    title: j.title ?? "",
    company: j.company ?? "",
    location: j.location ?? "Worldwide",
    description: j.description ?? "",
    apply_url: j.apply_url,
  }));

  const { data, error } = await supabase
    .from("jobs")
    .upsert(rows, { onConflict: "apply_url", ignoreDuplicates: true })
    .select("id");

  if (error) throw error;
  const inserted = Array.isArray(data) ? data.length : 0;
  return { fetched: jobs.length, inserted };
}

/** Calls the LinkedIn jobs API (service layer) and returns normalized job records. */
async function fetchLinkedInJobs(): Promise<{ title: string; company: string; location: string; description: string; apply_url: string }[]> {
  let fetchJobListings: (keywords: string, location: string, dateSincePosted?: string) => Promise<{ title?: string; company?: string; location?: string; link?: string; description?: string }[]>;
  try {
    const service = await import("@atharvh01/linkedin-jobs-api/src/services/linkedinService.js");
    fetchJobListings = service.fetchJobListings;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Cannot find module") || msg.includes("ERR_MODULE_NOT_FOUND")) {
      throw new Error(
        "LinkedIn jobs API package is not installed or failed to install. Run: npm install @atharvh01/linkedin-jobs-api"
      );
    }
    throw e;
  }

  if (typeof fetchJobListings !== "function") {
    throw new Error("LinkedIn jobs API: fetchJobListings not found");
  }

  const keywords = "remote developer";
  const location = "Worldwide";
  const dateSincePosted = "past_week";

  const list = await fetchJobListings(keywords, location, dateSincePosted);
  if (!Array.isArray(list)) return [];

  return list
    .map((j: Record<string, unknown>) => ({
      title: String(j.title ?? ""),
      company: String(j.company ?? ""),
      location: String(j.location ?? "Worldwide"),
      description: String(j.description ?? ""),
      apply_url: String(j.link ?? j.job_url ?? j.url ?? ""),
    }))
    .filter((j: { apply_url: string }) => j.apply_url.length > 0);
}
