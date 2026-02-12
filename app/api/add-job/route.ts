import { getSupabaseServer } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = getSupabaseServer();

  const { error } = await supabase.from("jobs").insert([
    {
      ...body,
      created_at: new Date(),
    },
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}
