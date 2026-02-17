"use client";

import { useEffect, useState } from "react";

export default function JobsList() {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((res) => res.json())
      .then((data) => {
        setJobs(data);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <p>Loading jobs...</p>;
  }

  return (
    <div className="grid gap-6">
      {jobs.map((job) => (
        <div
          key={job.id}
          className="border rounded-lg p-6 hover:shadow-md transition"
        >
          <h3 className="text-xl font-semibold text-green-800">
            {(job.title || "")
              .replace(/\s*\([mwd]\/[mwd]\/[mwd]\)\s*/gi, " ")
              .replace(/\s+/g, " ")
              .trim() || job.title}
          </h3>

          <p className="text-gray-600 mt-1">
            {job.company_name} · {job.candidate_required_location}
          </p>

          <a
            href={job.url}
            target="_blank"
            className="inline-block mt-3 text-green-700 font-medium"
          >
            Apply →
          </a>
        </div>
      ))}
    </div>
  );
}