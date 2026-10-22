"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Mountain, Plus, TrendingUp, Users, Compass } from "lucide-react"
import Link from "next/link"
import { getDashboardData, getUserGroups } from "@/lib/api"
import LogTrekModal from "@/components/LogTrekModal"

type User = {
  name: string
  username: string
  city: string
  trail_score: number
  rank: string
}

type LeaderboardEntry = {
  name: string
  username: string
  trail_score: number
}

type Trek = {
  name: string
  location: string
  difficulty: string
  distance_km: number
  elevation_m: number
}

const difficultyColor: Record<string, string> = {
  Easy:      "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Moderate:  "text-amber-400   bg-amber-400/10   border-amber-400/20",
  Hard:      "text-red-400     bg-red-400/10     border-red-400/20",
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser]               = useState<User | null>(null)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [recommended, setRecommended] = useState<Trek | null>(null)
  const [loading, setLoading]         = useState(true)
  const [showModal, setShowModal]     = useState(false)
  const [myGroupsCount, setMyGroupsCount] = useState({ hosted: 0, joined: 0 })

  const fetchDashboard = useCallback(() => {
    const username = localStorage.getItem("username")

    if (!username) {
      router.push("/login")
      return
    }

    getDashboardData(username)
      .then((data) => {
        setUser(data.user)
        setLeaderboard(data.leaderboard)
        setRecommended(data.recommended_trek)
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    getUserGroups(username)
      .then((data) => {
        setMyGroupsCount({
          hosted: data.hosted_groups.length,
          joined: data.joined_groups.length,
        })
      })
      .catch(() => {})
  }, [router])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  const handleRetry = () => {
    setLoading(true)
    fetchDashboard()
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-emerald-400 text-lg animate-pulse">Loading dashboard...</div>
    </div>
  )

  if (!user) return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <div className="text-red-400">Failed to load dashboard</div>
      <button
        onClick={handleRetry}
        className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
      >
        Retry
      </button>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">

      {/* NAVBAR */}
      <nav className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md fixed top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
            <Mountain className="w-6 h-6 text-emerald-400" />
            TrailVerse
          </Link>
          <Link
            href={`/profile/${user.username}`}
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            My Profile
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16">

        {/* TOP BAR */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">
              Welcome back, {user.name.split(" ")[0]} 👋
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Trail Score:{" "}
              <span className="text-emerald-400 font-semibold">
                {user.trail_score.toLocaleString()}
              </span>
              {" "}· {user.rank} · {user.city}
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Log a Trek
          </button>
        </div>

        {/* TWO COLUMNS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* LEFT COLUMN */}
          <div className="lg:col-span-2 space-y-6">

            {/* AI Recommendation */}
            {recommended && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Compass className="w-4 h-4 text-purple-400" />
                  <h2 className="text-white font-semibold">AI Trek Recommendation</h2>
                  <span className="text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 px-2 py-0.5 rounded-full ml-auto">
                    Personalized for you
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 items-start">
                  <div className="flex-1">
                    <h3 className="text-white text-lg font-bold mb-1">{recommended.name}</h3>
                    <p className="text-white/40 text-sm mb-3">{recommended.location}</p>

                    <div className="flex flex-wrap gap-3 mb-4">
                      {[
                        { label: "Distance",   value: `${recommended.distance_km} km` },
                        { label: "Elevation",  value: `${recommended.elevation_m} m` },
                        { label: "Difficulty", value: recommended.difficulty },
                      ].map((s) => (
                        <div key={s.label} className="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-center">
                          <div className="text-white text-sm font-semibold">{s.value}</div>
                          <div className="text-white/30 text-xs">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    <p className="text-white/50 text-sm">
                      Recommended based on your trek history and fitness level.
                    </p>
                  </div>

                  <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border shrink-0 ${difficultyColor[recommended.difficulty] || "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}`}>
                    <Compass className="w-3.5 h-3.5" />
                    {recommended.difficulty || "Recommended"}
                  </div>
                </div>
              </div>
            )}

            {/* Community Feed */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-blue-400" />
                <h2 className="text-white font-semibold">Community Feed</h2>
              </div>
              <p className="text-white/30 text-sm">Community feed coming in Phase 3 🚀</p>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="space-y-6">

            {/* Leaderboard */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h2 className="text-white font-semibold">{user.city} Rankings</h2>
              </div>

              <div className="space-y-2">
                {leaderboard.map((person, index) => (
                  <div
                    key={person.username}
                    className={`flex items-center gap-3 p-2 rounded-xl ${
                      person.username === user.username
                        ? "bg-emerald-500/10 border border-emerald-500/20"
                        : ""
                    }`}
                  >
                    <span className={`text-sm font-bold w-5 text-center ${
                      index === 0 ? "text-amber-400" :
                      index === 1 ? "text-slate-300" :
                      index === 2 ? "text-amber-600" : "text-white/30"
                    }`}>
                      {index + 1}
                    </span>

                    <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold">
                      {person.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>

                    <span className={`text-sm flex-1 ${
                      person.username === user.username
                        ? "text-emerald-400 font-semibold"
                        : "text-white/70"
                    }`}>
                      {person.username === user.username ? "You" : person.name.split(" ")[0]}
                    </span>

                    <span className="text-sm text-white/50 font-mono">
                      {person.trail_score.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* My Groups */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-pink-400" />
                <h2 className="text-white font-semibold">My Groups</h2>
              </div>
              <div className="flex gap-3 mb-4">
                <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-white text-lg font-bold">{myGroupsCount.hosted}</div>
                  <div className="text-white/30 text-xs">Hosting</div>
                </div>
                <div className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 text-center">
                  <div className="text-white text-lg font-bold">{myGroupsCount.joined}</div>
                  <div className="text-white/30 text-xs">Joined</div>
                </div>
              </div>
              <Link
                href="/groups"
                className="block text-center text-emerald-400 text-sm hover:text-emerald-300 transition-colors"
              >
                Browse all groups →
              </Link>
            </div>

          </div>
        </div>
      </main>

      {/* LOG TREK MODAL */}
      {showModal && (
        <LogTrekModal
          username={user.username}
          onClose={() => setShowModal(false)}
          onSuccess={fetchDashboard}
        />
      )}

    </div>
  )
}