export default function JobsPage() {
  return (
    <main className="min-h-screen px-6 py-12 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-green-900">
        All Remote Climate Jobs
      </h1>

      <p className="mt-3 text-gray-600">
        Browse curated climate, sustainability, and green-tech roles.
      </p>

      <div className="mt-10 grid gap-4">
        {[
          "Climate Policy Analyst",
          "ESG Reporting Specialist",
          "Sustainability Program Manager",
          "Renewable Energy Engineer"
        ].map((job, i) => (
          <div
            key={i}
            className="border rounded-lg p-5 hover:shadow-sm transition"
          >
            <h3 className="font-medium text-lg">{job}</h3>
            <p className="text-sm text-gray-500 mt-1">
              Remote · Sustainability
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
