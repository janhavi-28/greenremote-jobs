import { NextResponse } from "next/server";
import { ensureJobEnglish } from "@/lib/translate";
import { insertJob } from "@/lib/jobs";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const title = String(body?.title ?? "").trim();
    const company = String(body?.company ?? "").trim();
    const location = String(body?.location ?? "Remote").trim() || "Remote";
    const description =
      body?.description == null ? null : String(body.description).trim() || null;
    const apply_url = String(body?.apply_url ?? "").trim();

    if (!title || !company || !apply_url) {
      return NextResponse.json(
        { error: "title, company and apply_url are required" },
        { status: 400 },
      );
    }

    const translated = await ensureJobEnglish({
      title,
      company,
      location,
      description,
    });

    const id = await insertJob({
      ...body,
      title: translated.title,
      company: translated.company,
      location: translated.location ?? location,
      description: translated.description ?? description,
      apply_url,
    });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add job" },
      { status: 500 },
    );
  }
}
