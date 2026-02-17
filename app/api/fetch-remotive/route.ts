import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const supabase = getSupabaseServer();
  const { searchParams } = new URL(req.url);

  const page = Number(searchParams.get("page")) || 0;
  const limit = 20;
  const from = page * limit;
  const to = from + limit - 1;

  const search = searchParams.get("search");
  const location = searchParams.get("location");
  const category = searchParams.get("category");

  let query = supabase
    .from("jobs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(
      `title.ilike.%${search}%,company.ilike.%${search}%`
    );
  }

  if (location) {
    query = query.ilike("location", `%${location}%`);
  }

  if (category) {
    query = query.ilike("category", `%${category}%`);
  }

  const { data, count, error } = await query.range(from, to);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ jobs: data, total: count });
}