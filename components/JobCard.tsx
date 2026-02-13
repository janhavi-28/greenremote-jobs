"use client";

interface JobCardProps {
  job: {
    id?: string;
    title?: string;
    company?: string;
    company_name?: string;
    location?: string;
    candidate_required_location?: string;
    category?: string | null;
    description?: string | null;
    publication_date?: string | null;
    created_at?: string;
    apply_url?: string;
    url?: string;
    experience_level?: string | null;
  };
  isAdmin?: boolean;
}

function stripHtml(html: string | null | undefined): string {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").trim();
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function isRemote(loc: string | undefined | null): boolean {
  if (!loc) return false;
  return /remote/i.test(loc);
}

/** Remove gender designation like (m/w/d) from job titles, anywhere in the string. */
function stripGenderDesignation(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/\s*\([mwd]\/[mwd]\/[mwd]\)\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default function JobCard({ job, isAdmin }: JobCardProps) {
  const company = job.company ?? job.company_name ?? "Company";
  const location = job.location ?? job.candidate_required_location ?? "—";
  const applyUrl = job.apply_url ?? job.url ?? "#";
  const title = stripGenderDesignation(job.title) || job.title || "";
  const snippet = stripHtml(job.description).slice(0, 160);
  const date = formatDate(job.publication_date ?? job.created_at);
  const remote = isRemote(location);

  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5 sm:p-6 shadow-lg hover:border-zinc-700 hover:bg-zinc-900/80 transition-all duration-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {remote && (
              <span className="inline-flex items-center rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-xs font-medium text-cyan-400">
                Remote
              </span>
            )}
            {job.experience_level && (
              <span className="inline-flex items-center rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                {job.experience_level}
              </span>
            )}
            {job.category && (
              <span className="inline-flex items-center rounded-full bg-zinc-700 px-2.5 py-0.5 text-xs font-medium text-zinc-300">
                {job.category}
              </span>
            )}
          </div>

          <h2 className="text-lg font-semibold text-cyan-400 tracking-tight hover:text-cyan-300">
            {title}
          </h2>

          <p className="mt-1 text-sm text-zinc-400">
            <span className="font-medium text-zinc-300">{company}</span>
            <span className="text-zinc-600 mx-2">·</span>
            <span>{location}</span>
          </p>

          {snippet && (
            <p className="mt-3 text-sm text-zinc-500 line-clamp-2">
              {snippet}
              {stripHtml(job.description).length > 160 ? "…" : ""}
            </p>
          )}

          {date && (
            <p className="mt-3 text-xs text-zinc-500">Posted {date}</p>
          )}
        </div>

        <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0">
          <a
            href={applyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 transition-colors"
          >
            View details
          </a>
          {isAdmin && (
            <button
              type="button"
              className="text-xs text-red-400 hover:text-red-300 hover:underline"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
