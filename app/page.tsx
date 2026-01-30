export default function Home() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">
      
      {/* Hero */}
      <section className="text-center py-20">
        <h1 className="text-4xl md:text-5xl font-bold text-green-900">
          Remote Climate & Sustainability Jobs
        </h1>
        <p className="mt-6 text-lg text-gray-600 max-w-2xl mx-auto">
          Curated remote roles from climate tech startups, green companies,
          and impact-driven organizations. No noise. Just meaningful work.
        </p>

        <div className="mt-8 flex justify-center gap-4">
          <button className="bg-green-900 text-white px-6 py-3 rounded-md font-medium hover:bg-green-800 transition">
            Get Weekly Jobs
          </button>
          <button className="border border-green-900 text-green-900 px-6 py-3 rounded-md font-medium hover:bg-green-50 transition">
            Post a Job
          </button>
        </div>
      </section>

      {/* Jobs Preview */}
      <section className="mt-16">
        <h2 className="text-2xl font-semibold mb-6">Latest Opportunities</h2>

        <div className="grid gap-4">
          {[
            "Climate Analyst – Remote",
            "Sustainability Consultant",
            "Carbon Accounting Specialist",
            "Renewable Energy Research Intern"
          ].map((job, i) => (
            <div
              key={i}
              className="border rounded-lg p-5 hover:shadow-sm transition"
            >
              <h3 className="font-medium text-lg">{job}</h3>
              <p className="text-sm text្ text-gray-500 mt-1">
                Remote · Climate Tech
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-24 border-t pt-8 text-center text-sm text-gray-500">
        GreenRemote Jobs © {new Date().getFullYear()}  
        <br />
        Remote work for a better planet 🌍
      </footer>
    </main>
  );
}
