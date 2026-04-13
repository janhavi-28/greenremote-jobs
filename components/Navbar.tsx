"use client";

import Link from "next/link";

export default function Navbar() {
  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-xl font-bold tracking-tight text-zinc-100 hover:text-cyan-400 transition">
            GreenRemote
          </Link>
          <Link href="/jobs" className="text-sm font-medium text-zinc-400 hover:text-cyan-400 transition">
            Find Jobs
          </Link>
          <Link href="/post-job" className="text-sm font-medium text-zinc-400 hover:text-cyan-400 transition">
            Post a Job
          </Link>
        </div>

        <div className="text-xs text-zinc-500">
          Mongo Atlas powered jobs board
        </div>
      </div>
    </nav>
  );
}
