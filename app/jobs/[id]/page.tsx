import { notFound } from "next/navigation";
import Link from "next/link";
import JobDescriptionPreview from "@/components/JobDescriptionPreview";
import { getJobById } from "@/lib/jobs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface JobDetailsPageProps {
  params: Promise<{ id: string }>;
}

export default async function JobDetailsPage({ params }: JobDetailsPageProps) {
  const resolvedParams = await params;
  const id = decodeURIComponent(resolvedParams.id);
  const job = await getJobById(id);

  if (!job) {
    notFound();
  }

  const title = job.title || "Untitled Job";
  const company = job.company ?? "Unknown Company";
  const location = job.location ?? "Remote/Worldwide";
  const experience = job.experience_level ?? "Not specified";
  const applyUrl = job.apply_url;
  const hasRealApplyUrl = Boolean(applyUrl && /^https?:\/\//i.test(applyUrl));

  return (
    <div className="min-h-screen bg-zinc-950 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <Link
          href="/jobs"
          className="inline-flex items-center text-sm font-medium text-cyan-500 hover:text-cyan-400 transition"
        >
          &larr; Back to all jobs
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-sm">
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-4">
            {title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-4 text-zinc-300">
            <p className="flex items-center gap-2">
              <span className="font-semibold text-white">{company}</span>
            </p>
            <p className="flex items-center gap-2 text-zinc-400">
              <span className="text-zinc-600">.</span> {location}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <span className="inline-flex items-center rounded-full bg-cyan-900/40 border border-cyan-800/60 px-3 py-1 text-sm font-medium text-cyan-300">
              {job.category || "General"}
            </span>
            <span className="inline-flex items-center rounded-full bg-zinc-800 px-3 py-1 text-sm font-medium text-zinc-300">
              {experience}
            </span>
            {/remote/i.test(location) && (
              <span className="inline-flex items-center rounded-full bg-emerald-900/40 border border-emerald-800/60 px-3 py-1 text-sm font-medium text-emerald-300">
                Remote
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-zinc-400">
            Interested in this role at <span className="text-zinc-300 font-medium">{company}</span>?
          </p>
          {hasRealApplyUrl ? (
            <a
              href={applyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-cyan-600 px-8 py-3.5 text-base font-medium text-white shadow-md hover:bg-cyan-500 hover:shadow-lg transition-all"
            >
              Apply for this job
            </a>
          ) : (
            <button
              disabled
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-zinc-800 px-8 py-3.5 text-base font-medium text-zinc-500 cursor-not-allowed"
            >
              No apply link listed
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-8">
          <h2 className="text-xl font-bold text-white mb-6">Job Description</h2>
          <div className="prose prose-invert prose-cyan max-w-none text-zinc-300 whitespace-pre-wrap leading-relaxed">
            <JobDescriptionPreview jobId={id} initialDescription={job.description} />
          </div>
        </div>
      </div>
    </div>
  );
}
