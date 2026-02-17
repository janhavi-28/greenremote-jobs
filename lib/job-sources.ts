/**
 * Normalized job row for Supabase jobs table.
 * apply_url is required and unique.
 */
export interface NormalizedJob {
  title: string;
  company: string;
  location: string;
  category: string | null;
  description: string | null;
  publication_date: string | null;
  apply_url: string;
  experience_level: string | null;
}

const FETCH_TIMEOUT_MS = 15_000;

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------------------------ */
/* TYPE GUARD HELPERS                               */
/* ------------------------------------------------ */

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasKeys(
  obj: Record<string, unknown>,
  keys: string[]
): boolean {
  return keys.every((k) => k in obj);
}

/* ------------------------------------------------ */
/* REMOTIVE                                         */
/* https://remotive.com/api/remote-jobs             */
/* ------------------------------------------------ */

async function fetchRemotive(limit = 100): Promise<NormalizedJob[]> {
  const url = `https://remotive.com/api/remote-jobs?limit=${limit}`;
  const data = await fetchJson<{ jobs?: unknown[] }>(url);
  const jobs = Array.isArray(data?.jobs) ? data.jobs : [];

  return jobs
    .filter(
      (j): j is Record<string, unknown> =>
        isObject(j) &&
        hasKeys(j, ["url", "title", "company_name"])
    )
    .map((j) => ({
      title: String(j.title ?? ""),
      company: String(j.company_name ?? ""),
      location: String(j.candidate_required_location ?? "Remote"),
      category: j.category != null ? String(j.category) : null,
      description: j.description != null ? String(j.description) : null,
      publication_date:
        j.publication_date != null ? String(j.publication_date) : null,
      apply_url: String(j.url ?? ""),
      experience_level: j.job_type != null ? String(j.job_type) : null,
    }));
}

/* ------------------------------------------------ */
/* REMOTEOK                                         */
/* https://remoteok.com/api                         */
/* ------------------------------------------------ */

async function fetchRemoteOk(): Promise<NormalizedJob[]> {
  const data = await fetchJson<unknown[]>("https://remoteok.com/api");
  if (!Array.isArray(data)) return [];

  const jobs = data.filter(
    (item: unknown): item is Record<string, unknown> =>
      isObject(item) &&
      "position" in item &&
      "apply_url" in item
  );

  return jobs.map((j) => ({
    title: String(j.position ?? ""),
    company: String(j.company ?? ""),
    location: String(j.location ?? "Remote"),
    category:
      Array.isArray(j.tags) && j.tags[0] != null
        ? String(j.tags[0])
        : null,
    description: j.description != null ? String(j.description) : null,
    publication_date: j.date != null ? String(j.date) : null,
    apply_url: String(j.apply_url ?? j.url ?? ""),
    experience_level: null,
  }));
}

/* ------------------------------------------------ */
/* ARBEITNOW                                        */
/* https://www.arbeitnow.com/api/job-board-api      */
/* ------------------------------------------------ */

async function fetchArbeitNow(): Promise<NormalizedJob[]> {
  try {
    const data = await fetchJson<{ data?: unknown[] }>(
      "https://www.arbeitnow.com/api/job-board-api"
    );

    const list = Array.isArray(data?.data) ? data.data : [];

    return list
      .filter(
        (j): j is Record<string, unknown> =>
          isObject(j) &&
          hasKeys(j, ["url", "title", "company_name"])
      )
      .map((j) => {
        const createdAt = j.created_at;

        const pubDate =
          typeof createdAt === "number"
            ? new Date(createdAt * 1000).toISOString()
            : createdAt != null
            ? String(createdAt)
            : null;

        const jobTypes = j.job_types;

        const expLevel =
          Array.isArray(jobTypes) && jobTypes[0] != null
            ? String(jobTypes[0])
            : null;

        return {
          title: String(j.title ?? ""),
          company: String(j.company_name ?? ""),
          location: String(
            j.location || (j.remote ? "Remote" : "") || "Remote"
          ),
          category:
            Array.isArray(j.tags) && j.tags[0] != null
              ? String(j.tags[0])
              : null,
          description: j.description != null ? String(j.description) : null,
          publication_date: pubDate,
          apply_url: String(j.url ?? ""),
          experience_level: expLevel,
        };
      });
  } catch {
    return [];
  }
}

/* ------------------------------------------------ */
/* RESULT TYPES                                     */
/* ------------------------------------------------ */

export interface FetchJobsResult {
  source: string;
  count: number;
  jobs: NormalizedJob[];
  error?: string;
}

/* ------------------------------------------------ */
/* FETCH ALL SOURCES                                */
/* ------------------------------------------------ */

export async function fetchAllJobSources(): Promise<FetchJobsResult[]> {
  const results: FetchJobsResult[] = [];

  const remotive = await fetchRemotive(150)
    .then((jobs) => ({ source: "remotive", count: jobs.length, jobs }))
    .catch((e) => ({
      source: "remotive",
      count: 0,
      jobs: [] as NormalizedJob[],
      error: e instanceof Error ? e.message : String(e),
    }));
  results.push(remotive);

  const remoteok = await fetchRemoteOk()
    .then((jobs) => ({ source: "remoteok", count: jobs.length, jobs }))
    .catch((e) => ({
      source: "remoteok",
      count: 0,
      jobs: [] as NormalizedJob[],
      error: e instanceof Error ? e.message : String(e),
    }));
  results.push(remoteok);

  const arbeitnow = await fetchArbeitNow()
    .then((jobs) => ({ source: "arbeitnow", count: jobs.length, jobs }))
    .catch((e) => ({
      source: "arbeitnow",
      count: 0,
      jobs: [] as NormalizedJob[],
      error: e instanceof Error ? e.message : String(e),
    }));
  results.push(arbeitnow);

  return results;
}