import Link from "next/link";

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-lg rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-zinc-100 mb-2">Signup disabled</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Supabase auth has been removed from this project. Mongo Atlas is now used only for job storage.
        </p>
        <Link
          href="/jobs"
          className="inline-flex rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-cyan-500 transition"
        >
          Back to jobs
        </Link>
      </div>
    </div>
  );
}
