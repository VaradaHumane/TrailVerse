"use client"

import { useState, useSyncExternalStore } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mountain, Menu, X, User, LogOut } from "lucide-react"
import { supabase } from "@/lib/supabaseClient"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot() {
  return localStorage.getItem("username")
}

function getServerSnapshot() {
  return null
}

export default function Navbar() {
  const router = useRouter()
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
    } catch (e) {
      console.warn("Supabase sign out:", e)
    }
    localStorage.removeItem("username")
    window.dispatchEvent(new Event("storage"))
    router.push("/")
  }

  return (
    <nav className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md fixed top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
          <Mountain className="w-6 h-6 text-emerald-400" />
          TrailVerse
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-6">
          <Link href="/explore" className="text-sm text-white/70 hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="/groups" className="text-sm text-white/70 hover:text-white transition-colors">
            Groups
          </Link>
          <Link href="/features" className="text-sm text-white/70 hover:text-white transition-colors">
            Features
          </Link>

          {username ? (
            <>
              <Link href="/dashboard" className="text-sm text-white/70 hover:text-white transition-colors">
                Dashboard
              </Link>
              <Link
                href={`/profile/${username}`}
                className="flex items-center gap-1.5 text-sm text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1.5 rounded-full hover:bg-emerald-500/20 transition-colors"
              >
                <User className="w-3.5 h-3.5" />
                @{username}
              </Link>
              <button
                onClick={handleLogout}
                title="Log out"
                className="text-white/40 hover:text-white transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
                Log in
              </Link>
              <Link
                href="/signup"
                className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-full transition-colors font-medium"
              >
                Join free
              </Link>
            </>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden text-white/70 hover:text-white p-2"
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-b border-white/10 px-6 py-4 space-y-3">
          <Link
            href="/explore"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-white/80 hover:text-white py-1"
          >
            Explore
          </Link>
          <Link
            href="/groups"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-white/80 hover:text-white py-1"
          >
            Groups
          </Link>
          <Link
            href="/features"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-white/80 hover:text-white py-1"
          >
            Features
          </Link>

          {username ? (
            <>
              <Link
                href="/dashboard"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-white/80 hover:text-white py-1"
              >
                Dashboard
              </Link>
              <Link
                href={`/profile/${username}`}
                onClick={() => setMobileMenuOpen(false)}
                className="block text-sm text-emerald-400 py-1"
              >
                Profile (@{username})
              </Link>
              <button
                onClick={() => {
                  setMobileMenuOpen(false)
                  handleLogout()
                }}
                className="block text-left text-sm text-red-400 hover:text-red-300 py-1"
              >
                Log out
              </button>
            </>
          ) : (
            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center text-sm text-white border border-white/20 py-2 rounded-xl"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                onClick={() => setMobileMenuOpen(false)}
                className="text-center text-sm bg-emerald-500 text-white py-2 rounded-xl font-medium"
              >
                Join free
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  )
}