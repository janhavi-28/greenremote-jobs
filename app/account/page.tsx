"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseClient } from "@/lib/supabase";

export default function AccountPage() {
  const router = useRouter();
  const supabase = getSupabaseClient();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }
      setEmail(user.email ?? "");
      setFullName(
        (user.user_metadata?.full_name || user.user_metadata?.name || "").trim()
      );
    };
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() || null },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      setSaved(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-lg">
        <h1 className="text-xl font-semibold text-zinc-100 mb-1">Account</h1>
        <p className="text-sm text-zinc-400 mb-6">
          Set the name shown in the header
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="fullName"
              className="block text-sm font-medium text-zinc-400 mb-1"
            >
              Display name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              className="w-full rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-1">
              Email
            </label>
            <p className="text-sm text-zinc-300">{email}</p>
          </div>
          {error && (
            <p className="text-sm text-red-400" role="alert">
              {error}
            </p>
          )}
          {saved && (
            <p className="text-sm text-cyan-400">Name updated.</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-cyan-600 px-4 py-2.5 font-medium text-white hover:bg-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900 disabled:opacity-50 disabled:pointer-events-none transition"
          >
            {loading ? "Saving…" : "Save name"}
          </button>
        </form>

        <p className="mt-4 text-center">
          <Link href="/" className="text-sm text-cyan-400 hover:text-cyan-300">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
