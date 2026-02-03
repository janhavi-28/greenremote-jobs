"use client";

import { useState } from "react";

export default function PostJob() {
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: any) {
    e.preventDefault();
    setLoading(true);

    const job = {
      title: e.target.title.value,
      company: e.target.company.value,
      location: e.target.location.value,
      apply_url: e.target.apply_url.value,
      source: "manual",
    };

    await fetch("/api/add-job", {
      method: "POST",
      body: JSON.stringify(job),
    });

    setLoading(false);
    alert("Job added successfully!");
    e.target.reset();
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">
        Post a Job
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          placeholder="Job title"
          required
          className="input"
        />

        <input
          name="company"
          placeholder="Company name"
          required
          className="input"
        />

        <input
          name="location"
          placeholder="Remote / India / Global"
          required
          className="input"
        />

        <input
          name="apply_url"
          placeholder="Apply link (LinkedIn / careers page)"
          required
          className="input"
        />

        <button
          disabled={loading}
          className="bg-green-700 text-white px-4 py-2 rounded"
        >
          {loading ? "Posting..." : "Post Job"}
        </button>
      </form>
    </main>
  );
}
