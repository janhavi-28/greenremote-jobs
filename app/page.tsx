import { supabase } from "@/lib/supabase";
import Link from "next/link";

export default async function Home() {
  const { data: jobs } = await supabase
    .from("jobs")
    .select("*")
    .order("id", { ascending: false });

  return (
    <main className="max-w-5xl mx-auto px-6 py-16">
      {/* HERO */}
      <h1 className="text-4xl font-bold text-green-700 text-center">
        Green Remote Jobs
      </h1>

      <p className="text-center mt-3 text-neutral-600">
        Find remote jobs in one click.
      </p>

      <div className="flex justify-center gap-4 mt-6">
        <button className="bg-green-700 text-white px-6 py-2 rounded-md">
          Get Weekly Jobs
        </button>

        <Link
          href="/post-job"
          className="border border-green-700 text-green-700 px-6 py-2 rounded-md"
        >
          Post a Job
        </Link>
      </div>

      {/* JOB LIST */}
      <section className="mt-14">
        <h2 className="text-2xl font-semibold mb-6">
          Latest Opportunities
        </h2>

        <div className="space-y-4">
          {jobs?.map((job) => (
            <div
              key={job.id}
              className="border rounded-lg p-4 hover:shadow-sm"
            >
              <h3 className="text-lg font-semibold">
                {job.title}
              </h3>

              <p className="text-sm text-neutral-600 mt-1">
                {job.company} · {job.location}
              </p>

              {job.apply_url && (
                <a
                  href={job.apply_url}
                  target="_blank"
                  className="inline-block mt-3 text-green-700 font-medium"
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
