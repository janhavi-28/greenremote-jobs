import Link from "next/link";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">Auth removed</h1>
        <p className="text-sm text-zinc-400 mb-6">
          This project no longer uses Supabase auth. The jobs board now stores job data in Mongo Atlas.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/jobs"
            className="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition"
          >
            Browse jobs
          </Link>
          <Link
            href="/admin"
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm text-zinc-200 hover:bg-zinc-800 transition"
          >
            Open admin
          </Link>
        </div>
      </div>
    </div>
  );
}
