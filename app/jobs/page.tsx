import { getSupabaseServer } from "@/lib/supabase";
import { getJobs } from "@/lib/jobs";
import type { JobFilters, SortOption } from "@/lib/types";
import JobCard from "@/components/JobCard";
import JobsFilters from "@/components/JobsFilters";
import JobsPagination from "@/components/JobsPagination";
import JobsSearchBar from "@/components/JobsSearchBar";

const LIMIT = 12;

interface JobsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function JobsPage({ searchParams }: JobsPageProps) {
  const params = await searchParams;
  const get = (key: string) => {
    const v = params[key];
    return Array.isArray(v) ? v[0] : v;
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

  const supabase = getSupabaseServer();
  const { jobs, total, page, totalPages } = await getJobs(supabase, filters);
  const isAdmin = false;

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Hero search bar (Jobsora-style) */}
        <JobsSearchBar initialSearch={filters.search} initialLocation={filters.location} />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-8">
          {/* Sidebar filters */}
          <aside className="lg:col-span-4 xl:col-span-3">
            <JobsFilters initialFilters={filters} />
          </aside>

          {/* Main content */}
          <main className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* Results header: count + sort */}
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
                {jobs.map((job: Record<string, unknown>) => (
                  <li key={String(job.id)}>
                    <JobCard job={job} isAdmin={isAdmin} />
                  </li>
                ))}
              </ul>
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
