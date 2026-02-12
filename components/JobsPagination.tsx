"use client";

import Link from "next/link";

interface JobsPaginationProps {
  currentPage: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}

function buildUrl(
  searchParams: Record<string, string | string[] | undefined>,
  page: number
): string {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (key === "page") return;
    if (Array.isArray(value)) value.forEach((v) => params.append(key, v));
    else if (value != null && value !== "") params.set(key, String(value));
  });
  params.set("page", String(page));
  return `/jobs?${params.toString()}`;
}

const btnBase =
  "inline-flex items-center rounded-lg border px-3 py-2 text-sm font-medium transition";
const btnActive = "border-cyan-600 bg-cyan-600 text-white";
const btnLink =
  "border-zinc-600 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100";
const btnDisabled = "border-zinc-800 bg-zinc-900 text-zinc-600 cursor-not-allowed";

export default function JobsPagination({
  currentPage,
  totalPages,
  searchParams,
}: JobsPaginationProps) {
  const prevPage = Math.max(0, currentPage - 1);
  const nextPage = Math.min(totalPages - 1, currentPage + 1);
  const prevUrl = buildUrl(searchParams, prevPage);
  const nextUrl = buildUrl(searchParams, nextPage);

  const showPrev = currentPage > 0;
  const showNext = currentPage < totalPages - 1;

  const getPageNumbers = () => {
    const delta = 2;
    const range: number[] = [];
    const start = Math.max(0, currentPage - delta);
    const end = Math.min(totalPages - 1, currentPage + delta);
    for (let i = start; i <= end; i++) range.push(i);
    return range;
  };

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-2 pt-6 border-t border-zinc-800"
      aria-label="Pagination"
    >
      {showPrev ? (
        <Link href={prevUrl} className={`${btnBase} ${btnLink}`}>
          Previous
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>Previous</span>
      )}

      <div className="flex items-center gap-1">
        {currentPage > 2 && (
          <>
            <Link href={buildUrl(searchParams, 0)} className={`${btnBase} ${btnLink}`}>
              1
            </Link>
            {currentPage > 3 && <span className="px-1 text-zinc-500">…</span>}
          </>
        )}
        {getPageNumbers().map((p) =>
          p === currentPage ? (
            <span
              key={p}
              className={`${btnBase} ${btnActive}`}
              aria-current="page"
            >
              {p + 1}
            </span>
          ) : (
            <Link
              key={p}
              href={buildUrl(searchParams, p)}
              className={`${btnBase} ${btnLink}`}
            >
              {p + 1}
            </Link>
          )
        )}
        {currentPage < totalPages - 3 && (
          <>
            {currentPage < totalPages - 4 && <span className="px-1 text-zinc-500">…</span>}
            <Link
              href={buildUrl(searchParams, totalPages - 1)}
              className={`${btnBase} ${btnLink}`}
            >
              {totalPages}
            </Link>
          </>
        )}
      </div>

      {showNext ? (
        <Link href={nextUrl} className={`${btnBase} ${btnLink}`}>
          Next
        </Link>
      ) : (
        <span className={`${btnBase} ${btnDisabled}`}>Next</span>
      )}
    </nav>
  );
}
