import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";
import { getJobs } from "@/lib/jobs";
import type { JobFilters, SortOption } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const { searchParams } = new URL(req.url);

    const filters: JobFilters = {
      search: searchParams.get("search") ?? undefined,
      location: searchParams.get("location") ?? undefined,
      category: searchParams.get("category") ?? undefined,
      experience: searchParams.get("experience") ?? undefined,
      remote: searchParams.get("remote") === "1",
      sort: (searchParams.get("sort") as SortOption) || "newest",
      page: Number(searchParams.get("page")) || 0,
      limit: Math.min(Number(searchParams.get("limit")) || 12, 50),
    };

    const result = await getJobs(supabase, filters);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
