/**
 * Jobicy remote jobs API – extra source to increase job count.
 * https://jobicy.com/api/v2/remote-jobs
 */

export interface JobicyJobRow {
  title: string;
  company: string;
  location: string;
  description: string | null;
  apply_url: string;
}

const JOBICY_URL = "https://jobicy.com/api/v2/remote-jobs";
const FETCH_LIMIT = 100;
const TIMEOUT_MS = 15000;

export async function fetchJobicyJobs(): Promise<JobicyJobRow[]> {
  const url = `${JOBICY_URL}?count=${FETCH_LIMIT}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as { jobs?: unknown[] };
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

    return jobs
      .filter(
        (j): j is Record<string, unknown> =>
          typeof j === "object" &&
          j !== null &&
          "url" in j &&
          "jobTitle" in j
      )
      .map((j) => ({
        title: String(j.jobTitle ?? ""),
        company: String(j.companyName ?? ""),
        location: String(j.location ?? "Remote"),
        description: j.description != null ? String(j.description) : null,
        apply_url: String(j.url ?? ""),
      }));

  } catch (e) {
    clearTimeout(timeout);
    throw e;
  }
}