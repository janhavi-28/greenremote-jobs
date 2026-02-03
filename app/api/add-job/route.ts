import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const body = await req.json();

  await supabase.from("jobs").insert([
    {
      ...body,
      created_at: new Date(),
    },
  ]);

  return NextResponse.json({ success: true });
}
