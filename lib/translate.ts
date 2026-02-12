/**
 * Translate job text to English for consistent frontend display.
 * Uses MyMemory API (free, no key). Only translates when text appears non-English.
 */

const MYMEMORY_URL = "https://api.mymemory.translated.net/get";
const MAX_CHARS_PER_REQUEST = 400; // API limit ~500 bytes
const REQUEST_DELAY_MS = 200; // Avoid rate limits

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True if the character is in a non-Latin script (Arabic, Cyrillic, CJK, etc.). */
function hasNonLatinScript(text: string): boolean {
  for (const c of text) {
    const code = c.codePointAt(0)!;
    // Arabic, Cyrillic, CJK, Hebrew, Thai, etc.
    if (code >= 0x0600 && code <= 0x06ff) return true; // Arabic
    if (code >= 0x0750 && code <= 0x077f) return true; // Arabic Supplement
    if (code >= 0x0400 && code <= 0x04ff) return true; // Cyrillic
    if (code >= 0x4e00 && code <= 0x9fff) return true; // CJK Unified Ideographs
    if (code >= 0x0590 && code <= 0x05ff) return true; // Hebrew
    if (code >= 0x0e00 && code <= 0x0e7f) return true; // Thai
  }
  return false;
}

/** Heuristic: text is likely already English (skip translation to save quota). */
export function isLikelyEnglish(text: string): boolean {
  if (!text || text.length < 2) return true;
  const t = text.trim();
  // Any non-Latin script (e.g. Arabic "لوسيديا") → always translate
  if (hasNonLatinScript(t)) return false;
  // High ratio of non-ASCII or common diacritics
  const nonAscii = [...t].filter((c) => c.codePointAt(0)! > 127).length;
  if (nonAscii > t.length * 0.15) return false;
  if (/[äöüßàáâãäåèéêëìíîïòóôõùúûüýÿñç]/i.test(t)) return false;
  return true;
}

/**
 * Translate a single string to English. Returns original on failure or if empty.
 * Truncates to MAX_CHARS_PER_REQUEST to respect API limits.
 */
export async function translateToEnglish(text: string): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || isLikelyEnglish(trimmed)) return trimmed;
  const toTranslate = trimmed.length > MAX_CHARS_PER_REQUEST
    ? trimmed.slice(0, MAX_CHARS_PER_REQUEST)
    : trimmed;
  try {
    const url = new URL(MYMEMORY_URL);
    url.searchParams.set("q", toTranslate);
    url.searchParams.set("langpair", "auto|en");
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return trimmed;
    const data = (await res.json()) as { response?: { translatedText?: string }; quotaFinished?: boolean };
    if (data.quotaFinished) return trimmed;
    const translated = data.response?.translatedText?.trim();
    if (translated) return translated;
    return trimmed;
  } catch {
    return trimmed;
  }
}

export interface JobTextFields {
  title: string;
  company: string;
  location?: string | null;
  description?: string | null;
}

/**
 * Translate title, company, location, and description to English when they appear non-English.
 * Runs translations with a short delay between calls to avoid rate limits.
 */
export async function ensureJobEnglish<T extends JobTextFields>(job: T): Promise<T> {
  const title = await translateToEnglish(job.title);
  await delay(REQUEST_DELAY_MS);
  const company = await translateToEnglish(job.company);
  await delay(REQUEST_DELAY_MS);
  const location = job.location
    ? await translateToEnglish(String(job.location))
    : (job.location ?? "");
  await delay(REQUEST_DELAY_MS);
  const description =
    job.description && String(job.description).trim()
      ? await translateToEnglish(String(job.description).slice(0, MAX_CHARS_PER_REQUEST))
      : job.description;

  return { ...job, title, company, location, description };
}

const CONCURRENCY = 3;

/**
 * Translate an array of jobs to English. Processes CONCURRENCY jobs at a time to balance speed and rate limits.
 */
export async function ensureJobsEnglish<T extends JobTextFields>(jobs: T[]): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < jobs.length; i += CONCURRENCY) {
    const batch = jobs.slice(i, i + CONCURRENCY);
    const translated = await Promise.all(batch.map((j) => ensureJobEnglish(j)));
    out.push(...translated);
  }
  return out;
}
