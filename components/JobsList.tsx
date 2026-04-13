"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type JobListItem = {
  id: string;
  title: string;
  company: string;
  location: string;
  description?: string | null;
};

function stripHtml(html: string | null | undefined) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "");
}

export default function JobsList() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        setJobs((data.jobs || data) as JobListItem[]);
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading jobs...</p>;

  return (
    <div className="grid gap-6">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="border rounded-lg p-6 hover:shadow-md transition"
        >
          <h3 className="text-xl font-semibold text-green-800">
            {job.title}
          </h3>

          <p className="text-gray-600 mt-1">
            {job.company} . {job.location}
          </p>

          {job.description && (
            <p className="text-gray-700 mt-3 line-clamp-3">
              {stripHtml(job.description).slice(0, 200)}...
            </p>
          )}

          <Link href={`/jobs/${job.id}`} className="inline-block mt-3 text-green-700 font-medium">
            View details →
          </Link>
        </div>
      ))}
    </div>
  );
}
