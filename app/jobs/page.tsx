import { getJobs } from "@/lib/jobs";
import type { Job, JobFilters, SortOption } from "@/lib/types";
import JobCard from "@/components/JobCard";
import JobsClientRecovery from "@/components/JobsClientRecovery";
import JobsFilters from "@/components/JobsFilters";
import JobsPagination from "@/components/JobsPagination";
import JobsSearchBar from "@/components/JobsSearchBar";

const LIMIT = 12;

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getErrorDetails(error: unknown): string | null {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return null;
    }
  }
  return null;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams;
  const get = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };

  const filters: JobFilters = {
    search: get("search") ?? undefined,
    location: get("location") ?? undefined,
    category: get("category") ?? undefined,
    experience: get("experience") ?? undefined,
    remote: get("remote") === "1",
    sort: (get("sort") as SortOption) || "newest",
    page: Math.max(0, Number(get("page")) || 0),
    limit: LIMIT,
  };

  let jobs: Job[] = [];
  let total = 0;
  let page = filters.page ?? 0;
  let totalPages = 1;
  let loadError: string | null = null;

  try {
    const result = await getJobs(filters);
    jobs = result.jobs;
    total = result.total;
    page = result.page;
    totalPages = result.totalPages;
  } catch (error) {
    const details = getErrorDetails(error);
    if (process.env.NODE_ENV !== "production") {
      console.warn("Failed to load jobs:", details ?? error);
    }
    loadError =
      "Unable to load jobs right now. Please check your Mongo connection and try again.";
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <JobsSearchBar initialSearch={filters.search} initialLocation={filters.location} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          <aside className="lg:col-span-4 xl:col-span-3">
            <JobsFilters initialFilters={filters} />
          </aside>

          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-zinc-400">
                {total > 0 ? (
                  <>
                    <span className="font-semibold text-zinc-100">{total}</span>{" "}
                    {total === 1 ? "job" : "jobs"} found
                  </>
                ) : (
                  "No jobs match your filters."
                )}
              </p>
            </div>

            {jobs.length > 0 ? (
              <ul className="space-y-4">
                {jobs.map((job) => (
                  <li key={job.id}>
                    <JobCard job={job} isAdmin={false} />
                  </li>
                ))}
              </ul>
            ) : loadError ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-amber-700/40 bg-amber-950/30 p-6 text-center text-amber-200">
                  {loadError}
                </div>
                <JobsClientRecovery />
              </div>
            ) : (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-500">
                Try adjusting filters or search terms.
              </div>
            )}

            {totalPages > 1 && (
              <JobsPagination
                currentPage={page}
                totalPages={totalPages}
                searchParams={params}
              />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
