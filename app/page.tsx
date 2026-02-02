import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function Home() {
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    console.error(error);
  }

  return (
    <main style={{ padding: "40px" }}>
      <h1>Remote Climate & Sustainability Jobs</h1>

      <section style={{ marginTop: "40px" }}>
        <h2>Latest Opportunities</h2>

        {jobs && jobs.length === 0 && <p>No jobs yet</p>}

        {jobs?.map((job) => (
          <div
            key={job.id}
            style={{
              border: "1px solid #ddd",
              padding: "16px",
              marginBottom: "16px",
              borderRadius: "8px",
            }}
          >
            <h3>{job.title}</h3>
            <p>
              {job.company} · {job.location}
            </p>

            {job.apply_url && (
              <a
                href={job.apply_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                Apply →
              </a>
            )}
          </div>
        ))}
      </section>
    </main>
  );
}
