"use client";

import { useEffect, useMemo, useState } from "react";

interface JobDescriptionPreviewProps {
  jobId: string;
  initialDescription: string | null | undefined;
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

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, " ");
}

function normalizeDescription(raw: string | null | undefined): string {
  if (!raw) return "";
  const decoded = decodeBasicEntities(raw);
  const withoutTags = stripHtml(decoded);
  return withoutTags
    .replace(/\u00C2/g, " ")
    .replace(/\u00A0/g, " ")
    .replace(/[^\S\r\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export default function JobDescriptionPreview({
  jobId,
  initialDescription,
}: JobDescriptionPreviewProps) {
  const initial = useMemo(
    () => normalizeDescription(initialDescription),
    [initialDescription]
  );
  const shouldFetch = initial.length < 140;
  const [description, setDescription] = useState(initial);
  const [loading, setLoading] = useState(shouldFetch);

  useEffect(() => {
    if (!shouldFetch) return;

    let active = true;

    fetch(`/api/job-preview?id=${encodeURIComponent(jobId)}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as { description?: string };
        return data.description ?? "";
      })
      .then((desc) => {
        if (!active || !desc) return;
        const cleaned = normalizeDescription(desc);
        if (cleaned.length > 0) setDescription(cleaned);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [jobId, initial, shouldFetch]);

  if (!description) {
    return (
      <div className="space-y-2">
        <p>No detailed description provided for this job.</p>
        {loading && (
          <p className="text-xs text-cyan-400">Trying to fetch full description...</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p>{description}</p>
      {loading && (
        <p className="text-xs text-cyan-400">Fetching richer description...</p>
      )}
    </div>
  );
}
