import { SupabaseClient } from "@supabase/supabase-js";
import type { JobFilters } from "./types";

const DEFAULT_LIMIT = 12;

export interface GetJobsResult {
  jobs: Record<string, unknown>[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

const PG_UNDEFINED_COLUMN = "42703";

/** Build query with optional filters; skip columns that may not exist in DB. */
export function buildJobsQuery(
  supabase: SupabaseClient,
  filters: JobFilters,
  options: { skipOptionalColumns?: boolean } = {}
) {
  const limit = Math.min(Number(filters.limit) || DEFAULT_LIMIT, 50);
  const page = Math.max(0, Number(filters.page) || 0);
  const from = page * limit;
  const to = from + limit - 1;
  const sortAsc = filters.sort === "oldest";
  const skip = options.skipOptionalColumns ?? false;

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: sortAsc });

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`title.ilike.${term},company.ilike.${term}`);
  }
  if (filters.location?.trim()) {
    query = query.ilike("location", `%${filters.location.trim()}%`);
  }
  if (!skip && filters.category?.trim()) {
    query = query.ilike("category", `%${filters.category.trim()}%`);
  }
  if (!skip && filters.experience?.trim()) {
    query = query.ilike("experience_level", `%${filters.experience.trim()}%`);
  }
  if (filters.remote) {
    query = query.ilike("location", "%remote%");
  }

  return { query, from, to, limit, page };
}

export async function getJobs(
  supabase: SupabaseClient,
  filters: JobFilters
): Promise<GetJobsResult> {
  let { query, from, to, limit, page } = buildJobsQuery(supabase, filters);
  let { data, count, error } = await query.range(from, to);

  const isUndefinedColumn =
    error?.code === PG_UNDEFINED_COLUMN ||
    String(error?.message ?? "").includes("42703");
  if (error && isUndefinedColumn) {
    const fallback = buildJobsQuery(supabase, filters, { skipOptionalColumns: true });
    const result = await fallback.query.range(fallback.from, fallback.to);
    if (result.error) throw result.error;
    data = result.data;
    count = result.count;
    page = fallback.page;
  } else if (error) {
    throw error;
  }

  const total = count ?? 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    jobs: data ?? [],
    total,
    page,
    totalPages,
    limit,
  };
}
