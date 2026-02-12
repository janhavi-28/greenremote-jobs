"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import type { JobFilters } from "@/lib/types";
import { EXPERIENCE_OPTIONS } from "@/lib/types";

interface JobsFiltersProps {
  initialFilters: JobFilters;
}

function getString(value: unknown): string {
  if (value == null) return "";
  return String(value);
}

export default function JobsFilters({ initialFilters }: JobsFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState(getString(initialFilters.search));
  const [location, setLocation] = useState(getString(initialFilters.location));
  const [category, setCategory] = useState(getString(initialFilters.category));
  const [experience, setExperience] = useState(getString(initialFilters.experience));
  const [remote, setRemote] = useState(Boolean(initialFilters.remote));
  const [sort, setSort] = useState(initialFilters.sort ?? "newest");

  const applyFilters = useCallback(
    (overrides?: { page?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(overrides?.page ?? 0));

      if (search.trim()) params.set("search", search.trim());
      else params.delete("search");
      if (location.trim()) params.set("location", location.trim());
      else params.delete("location");
      if (category.trim()) params.set("category", category.trim());
      else params.delete("category");
      if (experience) params.set("experience", experience);
      else params.delete("experience");
      if (remote) params.set("remote", "1");
      else params.delete("remote");
      if (sort && sort !== "newest") params.set("sort", sort);
      else params.delete("sort");

      router.push(`/jobs?${params.toString()}`);
    },
    [search, location, category, experience, remote, sort, router, searchParams]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setLocation("");
    setCategory("");
    setExperience("");
    setRemote(false);
    setSort("newest");
    router.push("/jobs");
  }, [router]);

  const hasActiveFilters =
    search.trim() ||
    location.trim() ||
    category.trim() ||
    experience ||
    remote ||
    (sort && sort !== "newest");

  const inputClass =
    "w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none";
  const labelClass = "block text-sm font-medium text-zinc-400 mb-1";

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/80 shadow-lg overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="font-semibold text-zinc-100">Filters</h2>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="mt-1 text-sm text-cyan-400 hover:text-cyan-300 font-medium"
          >
            Clear all
          </button>
        )}
      </div>

      <form
        className="p-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          applyFilters();
        }}
      >
        <div>
          <label htmlFor="filter-search" className={labelClass}>Keyword</label>
          <input
            id="filter-search"
            type="text"
            placeholder="Job title or company"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="filter-location" className={labelClass}>Location</label>
          <input
            id="filter-location"
            type="text"
            placeholder="e.g. Remote, USA"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="filter-category" className={labelClass}>Category</label>
          <input
            id="filter-category"
            type="text"
            placeholder="e.g. Software, Marketing"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          />
        </div>

        {/* Date posted / Sort - collapsible style */}
        <details className="group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-zinc-300 py-1">
            Date posted
            <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="pt-2 space-y-2">
            {[
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ].map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400">
                <input
                  type="radio"
                  name="sort"
                  value={opt.value}
                  checked={sort === opt.value}
                  onChange={() => {
                    setSort(opt.value as "newest" | "oldest");
                    const p = new URLSearchParams(searchParams.toString());
                    p.set("page", "0");
                    if (opt.value !== "newest") p.set("sort", opt.value);
                    else p.delete("sort");
                    router.push(`/jobs?${p.toString()}`);
                  }}
                  className="h-4 w-4 border-zinc-600 bg-zinc-800 text-cyan-600 focus:ring-cyan-500"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </details>

        {/* Work experience */}
        <details className="group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-zinc-300 py-1">
            Work experience
            <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="pt-2">
            <select
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className={inputClass}
            >
              {EXPERIENCE_OPTIONS.map((opt) => (
                <option key={opt.value || "any"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </details>

        {/* Remote - radio style like Jobsora */}
        <details className="group" open>
          <summary className="flex items-center justify-between cursor-pointer list-none font-medium text-zinc-300 py-1">
            Remote
            <span className="text-zinc-500 group-open:rotate-180 transition-transform">▼</span>
          </summary>
          <div className="pt-2 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400">
              <input
                type="radio"
                name="remote"
                checked={!remote}
                onChange={() => setRemote(false)}
                className="h-4 w-4 border-zinc-600 bg-zinc-800 text-cyan-600 focus:ring-cyan-500"
              />
              Any
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm text-zinc-400">
              <input
                type="radio"
                name="remote"
                checked={remote}
                onChange={() => setRemote(true)}
                className="h-4 w-4 border-zinc-600 bg-zinc-800 text-cyan-600 focus:ring-cyan-500"
              />
              Remote only
            </label>
          </div>
        </details>

        <button
          type="submit"
          className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 transition"
        >
          Apply filters
        </button>
      </form>
    </div>
  );
}
