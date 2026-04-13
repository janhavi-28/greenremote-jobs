import { NextRequest, NextResponse } from "next/server";
import { deleteJobById, getJobs } from "@/lib/jobs";
import type { JobFilters, SortOption } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
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

    const result = await getJobs(filters);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const expectedKey = process.env.ADMIN_API_KEY;
    if (!expectedKey) {
      return NextResponse.json(
        { error: "Deletion is disabled until ADMIN_API_KEY is configured" },
        { status: 403 },
      );
    }

    const providedKey = req.headers.get("x-admin-key") ?? "";
    if (providedKey !== expectedKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const id = String(body?.id ?? "").trim();
    if (!id) {
      return NextResponse.json({ error: "Job id is required" }, { status: 400 });
    }

    const deleted = await deleteJobById(id);
    if (!deleted) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
