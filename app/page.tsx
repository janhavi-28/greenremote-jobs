import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .order("id", { ascending: false });

  return (
    <main className="px-6 py-16 max-w-5xl mx-auto">
      {/* HERO */}
      <h1 className="text-4xl font-bold text-green-800 text-center">
        Remote Jobs
      </h1>

      <p className="text-center mt-4 text-gray-600">
        Find remote jobs in one click.
      </p>

      <div className="flex justify-center gap-4 mt-6">
        <button className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800">
          Get Weekly Jobs
        </button>

        {/* ✅ WORKING POST JOB BUTTON */}
        <Link href="/post-job">
          <button className="border border-green-700 text-green-700 px-6 py-2 rounded hover:bg-green-50">
            Post a Job
          </button>
        </Link>
      </div>

      {/* JOB LIST */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">
          Latest Opportunities
        </h2>

        {error && (
          <p className="text-red-500">Failed to load jobs.</p>
        )}

        <div className="space-y-4">
          {jobs?.length === 0 && (
            <p className="text-gray-500">
              No jobs posted yet.
            </p>
          )}

          {jobs?.map((job) => (
            <div
              key={job.id}
              className="border rounded-lg p-4 hover:shadow transition"
            >
              <h3 className="font-semibold text-lg">
                {job.title}
              </h3>

              <p className="text-sm text-gray-600">
                {job.company} · {job.location}
              </p>

              {job.apply_url && (
                <a
                  href={job.apply_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-700 font-medium mt-2 inline-block"
                >
                  Apply →
                </a>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
