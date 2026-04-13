import { NextRequest, NextResponse } from "next/server";
import { ensureJobEnglish } from "@/lib/translate";
import { getJobDocumentById, updateJobById } from "@/lib/jobs";

type JobRecord = {
  id: string;
  title: string | null;
  company: string | null;
  location: string | null;
  description: string | null;
  apply_url: string | null;
  experience_level: string | null;
};

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function decodeBasicEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function parseJsonSafe(input: string): unknown {
  try {
    return JSON.parse(input);
  } catch {
    return null;
  }
}

function extractDescriptionFromLdJson(html: string): string {
  const scriptRegex =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: string[] = [];
  let match: RegExpExecArray | null = scriptRegex.exec(html);
  while (match) {
    blocks.push(match[1]);
    match = scriptRegex.exec(html);
  }

  for (const block of blocks) {
    const parsed = parseJsonSafe(block);
    if (!parsed) continue;

    const candidates = Array.isArray(parsed) ? parsed : [parsed];
    for (const candidate of candidates) {
      if (typeof candidate !== "object" || candidate === null) continue;

      const maybeDescription =
        "description" in candidate ? (candidate as { description?: unknown }).description : undefined;

      if (typeof maybeDescription === "string" && maybeDescription.trim().length > 80) {
        return stripHtml(decodeBasicEntities(maybeDescription));
      }
    }
  }

  return "";
}

function extractDescriptionFromMeta(html: string): string {
  const metaRegex =
    /<meta[^>]+(?:property|name)=["'](?:og:description|twitter:description|description)["'][^>]+content=["']([\s\S]*?)["'][^>]*>/gi;

  let match: RegExpExecArray | null = metaRegex.exec(html);
  while (match) {
    const content = stripHtml(decodeBasicEntities(match[1]));
    if (content.length > 80) return content;
    match = metaRegex.exec(html);
  }

  return "";
}

function extractDescriptionFromContainers(html: string): string {
  const containerPatterns = [
    /show-more-less-html__markup[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /description__text[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /jobs-description(?:-content)?[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
    /job-description[^>]*>([\s\S]*?)<\/(?:div|section)>/i,
  ];

  for (const pattern of containerPatterns) {
    const match = html.match(pattern);
    if (!match) continue;
    const text = stripHtml(decodeBasicEntities(match[1]));
    if (text.length > 80) return text;
  }

  return "";
}

async function fetchRichDescription(url: string): Promise<string> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return "";
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) return "";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(parsedUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
      cache: "no-store",
    });

    if (!response.ok) return "";

    const html = await response.text();
    return (
      extractDescriptionFromLdJson(html) ||
      extractDescriptionFromContainers(html) ||
      extractDescriptionFromMeta(html) ||
      ""
    );
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const encodedId = searchParams.get("id");
  const id = encodedId ? decodeURIComponent(encodedId) : null;

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data = await getJobDocumentById(id);
  if (!data) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const job = {
    id,
    title: data.title ?? null,
    company: data.company ?? null,
    location: data.location ?? null,
    description: data.description ?? null,
    apply_url: data.apply_url ?? null,
    experience_level: data.experience_level ?? null,
  } as JobRecord;

  const currentDescription = (job.description ?? "").trim();
  const currentUseful = stripHtml(currentDescription).length >= 140;
  let finalDescription = currentDescription;

  if (!currentUseful) {
    const richDescription = job.apply_url ? await fetchRichDescription(job.apply_url) : "";
    if (richDescription) {
      finalDescription = richDescription;
    }
  }

  const translated = await ensureJobEnglish({
    title: String(job.title ?? ""),
    company: String(job.company ?? ""),
    location: job.location ?? null,
    description: finalDescription || null,
  });

  const changed =
    translated.title !== (job.title ?? "") ||
    translated.company !== (job.company ?? "") ||
    translated.location !== (job.location ?? null) ||
    translated.description !== (job.description ?? null);

  if (changed) {
    await updateJobById(id, {
      title: translated.title,
      company: translated.company,
      location: translated.location ?? job.location ?? "Remote",
      description: translated.description ?? finalDescription ?? job.description,
    });
  }

  return NextResponse.json({
    title: translated.title || job.title || "",
    company: translated.company || job.company || "",
    location: translated.location ?? job.location ?? "",
    description: translated.description ?? finalDescription,
    experience_level: job.experience_level,
    source: changed ? "translated" : "database",
  });
}
