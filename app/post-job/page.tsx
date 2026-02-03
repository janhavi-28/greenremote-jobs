"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function PostJob() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [location, setLocation] = useState("");
  const [applyUrl, setApplyUrl] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    await supabase.from("jobs").insert([
      {
        title,
        company,
        location,
        apply_url: applyUrl,
      },
    ]);

    router.push("/");
  }

  return (
    <main className="max-w-xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold mb-6">
        Post a Job
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Job title"
          className="w-full border px-3 py-2 rounded"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />

        <input
          placeholder="Company name"
          className="w-full border px-3 py-2 rounded"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          required
        />

        <input
          placeholder="Location (Remote)"
          className="w-full border px-3 py-2 rounded"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          required
        />

        <input
          placeholder="Apply URL (LinkedIn / Careers page)"
          className="w-full border px-3 py-2 rounded"
          value={applyUrl}
          onChange={(e) => setApplyUrl(e.target.value)}
          required
        />

        <button
          type="submit"
          className="bg-green-700 text-white px-6 py-2 rounded"
        >
          Publish Job
        </button>
      </form>
    </main>
  );
}
