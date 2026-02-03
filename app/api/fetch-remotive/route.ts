import { supabase } from "@/lib/supabase";
import { NextResponse } from "next/server";

export async function GET() {
  const res = await fetch("https://remotive.com/api/remote-jobs");
  const data = await res.json();

  const jobs = data.jobs.slice(0, 20).map((job: any) => ({
    title: job.title,
    company: job.company_name,
    location: job.candidate_required_location || "Remote",
    apply_url: job.url,
    source: "api",
    created_at: new Date(),
  }));

  await supabase.from("jobs").insert(jobs);

  return NextResponse.json({ added: jobs.length });
}
