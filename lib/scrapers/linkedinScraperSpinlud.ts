/**
 * LinkedIn jobs scraper using linkedin-jobs-scraper (spinlud).
 * Fetches remote jobs and upserts into public.jobs.
 * Isolated module: does not modify any existing app logic.
 *
 * Supabase table expected columns: id, title, company, location, posted_date, job_url (UNIQUE), source, created_at
 */

import { LinkedinScraper, timeFilter, events } from "linkedin-jobs-scraper";
import { getSupabaseServer } from "@/lib/supabase";

const SOURCE = "LinkedIn";
const JOB_LIMIT = 25;

export interface LinkedInJobRow {
  title: string;
  company: string;
  location: string;
  posted_date: string;
  job_url: string;
  source: string;
}

interface ScraperData {
  title?: string;
  company?: string;
  place?: string;
  date?: string;
  dateText?: string;
  link?: string;
}

function mapJobToRow(data: ScraperData): LinkedInJobRow {
  return {
    title: data.title ?? "",
    company: data.company ?? "",
    location: data.place ?? "",
    posted_date: data.date ?? data.dateText ?? "",
    job_url: data.link ?? "",
    source: SOURCE,
  };
}

/**
 * Fetches at least 25 remote developer jobs from LinkedIn (past week, Worldwide)
 * and upserts them into public.jobs. Returns the number of inserted jobs.
 * Uses onConflict: "job_url". Handles errors without throwing into existing logic.
 */
export async function scrapeAndInsertLinkedInJobs(): Promise<number> {
  const jobs: LinkedInJobRow[] = [];

  return new Promise((resolve, reject) => {
    const scraper = new LinkedinScraper({
      headless: true,
      slowMo: 200,
      args: ["--lang=en-US", "--no-sandbox"],
    });

    scraper.on(events.scraper.data, (data: LinkedinScraperEventData) => {
      const link = data.link?.trim();
      if (link) {
        jobs.push(mapJobToRow(data));
      }
    });

    scraper.on(events.scraper.error, (err: Error) => {
      reject(err);
    });

    scraper.on(events.scraper.end, async () => {
      try {
        await scraper.close();
      } catch {
        // ignore close errors
      }
      if (jobs.length === 0) {
        resolve(0);
        return;
      }

      const supabase = getSupabaseServer();
      const rows = jobs
        .filter((r) => r.job_url.length > 0)
        .map((r) => ({
          title: r.title,
          company: r.company,
          location: r.location,
          posted_date: r.posted_date,
          job_url: r.job_url,
          source: r.source,
        }));

      const { data, error } = await supabase
        .from("jobs")
        .upsert(rows, { onConflict: "job_url", ignoreDuplicates: true })
        .select("id");

      if (error) {
        reject(error);
        return;
      }
      resolve(Array.isArray(data) ? data.length : 0);
    });

    scraper
      .run([
        {
          query: "remote developer",
          options: {
            locations: ["Worldwide"],
            limit: JOB_LIMIT,
            filters: {
              time: timeFilter.WEEK,
            },
          },
        },
      ])
      .catch(reject);
  });
}
