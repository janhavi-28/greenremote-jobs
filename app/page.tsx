export const dynamic = "force-dynamic";

import { supabase } from "@/lib/supabase";

export default async function Home() {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      {/* HERO */}
      <h1 className="text-4xl font-bold text-green-800 text-center">
        Green Remote Jobs
      </h1>

      <p className="text-center mt-4 text-gray-600">
        Find remote jobs in one click.
      </p>

      <div className="flex justify-center gap-4 mt-6">
        <button className="bg-green-700 text-white px-6 py-2 rounded hover:bg-green-800">
          Get Weekly Jobs
        </button>

        <a
          href="/post-job"
          className="border border-green-700 text-green-700 px-6 py-2 rounded hover:bg-green-50"
        >
          Post a Job
        </a>
      </div>

      {/* JOB LIST */}
      <section className="mt-12">
        <h2 className="text-2xl font-semibold mb-6">
          Latest Opportunities
        </h2>

        <div className="space-y-4">
          {jobs?.map((job) => (
            <div
              key={job.id}
              className="border rounded-lg p-4 hover:shadow"
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
                  className="text-green-700 font-medium mt-2 inline-block"
                >
                  Apply →
                </a>
              )}
            </div>
          ))}

          {jobs?.length === 0 && (
            <p className="text-gray-500">No jobs yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
