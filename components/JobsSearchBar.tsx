"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface JobsSearchBarProps {
  initialSearch?: string;
  initialLocation?: string;
}

export default function JobsSearchBar({ initialSearch = "", initialLocation = "" }: JobsSearchBarProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [location, setLocation] = useState(initialLocation);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (location.trim()) params.set("location", location.trim());
    params.set("page", "0");
    router.push(`/jobs?${params.toString()}`);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-3 p-4 rounded-xl bg-zinc-900 border border-zinc-800 shadow-lg"
    >
      <div className="flex-1 flex flex-col sm:flex-row gap-3 sm:gap-2">
        <div className="flex-1">
          <label htmlFor="hero-search" className="sr-only">Job title, keywords, or company</label>
          <input
            id="hero-search"
            type="text"
            placeholder="Job title, keywords, or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
        </div>
        <div className="sm:w-48">
          <label htmlFor="hero-location" className="sr-only">Where</label>
          <input
            id="hero-location"
            type="text"
            placeholder="Where (e.g. Remote)"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
          />
        </div>
      </div>
      <button
        type="submit"
        className="rounded-lg bg-cyan-600 px-6 py-2.5 font-medium text-white hover:bg-cyan-500 transition shrink-0"
      >
        Find Jobs
      </button>
    </form>
  );
}
