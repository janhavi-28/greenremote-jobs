"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PostJob() {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("Remote");
  const [applyUrl, setApplyUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("jobs").insert([
      {
        title,
        company,
        location,
        apply_url: applyUrl,
      },
    ]);

    if (error) {
      alert("Error adding job: " + error.message);
    } else {
      alert("Job added successfully!");
      setTitle("");
      setCompany("");
      setLocation("Remote");
      setApplyUrl("");
    }

    setLoading(false);
  };

  return (
    <main className="max-w-xl mx-auto mt-16 px-6">
      <h1 className="text-3xl font-bold mb-8 text-center">
        Post a Job
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Job title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border p-3 rounded"
        />

        <input
          type="text"
          placeholder="Company name"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
          className="w-full border p-3 rounded"
        />

        <input
          type="text"
          placeholder="Location (Remote)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          className="w-full border p-3 rounded"
        />

        <input
          type="url"
          placeholder="Apply URL"
          value={applyUrl}
          onChange={(e) => setApplyUrl(e.target.value)}
          required
          className="w-full border p-3 rounded"
        />

        <button
          type="submit"
          disabled={loading}
          className="bg-green-700 text-white px-6 py-2 rounded"
        >
          {loading ? "Publishing..." : "Publish Job"}
        </button>
      </form>
    </main>
  );
}
