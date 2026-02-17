"use client"

import { useEffect, useState } from "react"
import { getSupabaseClient } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const supabase = getSupabaseClient()

  useEffect(() => {
    const getInitial = async () => {
      const { data } = await supabase.auth.getUser()
      setUser(data.user)
    }
    getInitial()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <a href="/" className="text-xl font-bold tracking-tight text-zinc-100 hover:text-cyan-400 transition">
            GreenRemote
          </a>
          <a href="/jobs" className="text-sm font-medium text-zinc-400 hover:text-cyan-400 transition">
            Find Jobs
          </a>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="hidden sm:block text-right">
                <p className="text-xs text-zinc-500">Signed in as</p>
                <a
                  href="/account"
                  className="text-sm font-medium text-zinc-200 hover:text-cyan-400 truncate max-w-[180px] block"
                >
                  {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
                </a>
                {user.email && (user.user_metadata?.full_name || user.user_metadata?.name) && (
                  <p className="text-xs text-zinc-500 truncate max-w-[180px]">{user.email}</p>
                )}
              </div>
              <a
                href="/account"
                className="sm:hidden text-sm text-zinc-300 hover:text-cyan-400 truncate max-w-[120px] block"
              >
                {user.user_metadata?.full_name || user.user_metadata?.name || user.email}
              </a>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true)
                  try {
                    await supabase.auth.signOut()
                  } finally {
                    window.location.href = "/"
                  }
                }}
                className="shrink-0 text-sm px-4 py-2 border border-zinc-600 rounded-lg text-zinc-300 hover:bg-zinc-800 hover:border-zinc-500 transition disabled:opacity-50"
              >
                {loggingOut ? "Logging out…" : "Logout"}
              </button>
            </div>
          ) : (
            <a
              href="/login"
              className="text-sm px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition"
            >
              Sign in
            </a>
          )}
        </div>
      </div>
    </nav>
  )
}