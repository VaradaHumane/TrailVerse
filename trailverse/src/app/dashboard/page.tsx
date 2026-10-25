"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, TrendingUp, Users, Compass, Calendar, MapPin, ArrowRight } from "lucide-react"
import Link from "next/link"
import { getDashboardData, getUserGroups, listGroups } from "@/lib/api"
import LogTrekModal from "@/components/LogTrekModal"
import Navbar from "@/components/Navbar"

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

type CommunityGroup = {
  id: string
  title: string
  location: string
  cost: number
  start_date: string | null
  member_count: number
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
  const [recentGroups, setRecentGroups] = useState<CommunityGroup[]>([])
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
        setLeaderboard(data.leaderboard || [])
        setRecommended(data.recommended_trek || null)
      })
      .catch((err) => {
        console.error("Dashboard data load error:", err)
      })
      .finally(() => setLoading(false))

    getUserGroups(username)
      .then((data) => {
        setMyGroupsCount({
          hosted: data.hosted_groups?.length || 0,
          joined: data.joined_groups?.length || 0,
        })
      })
      .catch(() => {})

    listGroups()
      .then((data) => {
        setRecentGroups((data.groups || []).slice(0, 3))
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

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16">
        {loading ? (
          /* SKELETON PLACEHOLDER FOR FAST TRANSITIONS */
          <div className="animate-pulse space-y-8">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2">
                <div className="h-8 w-64 bg-white/10 rounded-lg" />
                <div className="h-4 w-48 bg-white/5 rounded-lg" />
              </div>
              <div className="h-10 w-32 bg-white/10 rounded-full" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-64 bg-white/5 border border-white/10 rounded-2xl" />
                <div className="h-56 bg-white/5 border border-white/10 rounded-2xl" />
              </div>
              <div className="space-y-6">
                <div className="h-64 bg-white/5 border border-white/10 rounded-2xl" />
                <div className="h-40 bg-white/5 border border-white/10 rounded-2xl" />
              </div>
            </div>
          </div>
        ) : !user ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center">
            <p className="text-red-400">Failed to load profile. Please check your connection or log in again.</p>
            <div className="flex gap-3">
              <button
                onClick={handleRetry}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Retry
              </button>
              <Link
                href="/login"
                className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-medium transition-colors"
              >
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <>
            {/* TOP BAR */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Welcome back, {user.name ? user.name.split(" ")[0] : user.username} 👋
                </h1>
                <p className="text-white/40 text-sm mt-1">
                  Trail Score:{" "}
                  <span className="text-emerald-400 font-semibold">
                    {user.trail_score ? user.trail_score.toLocaleString() : 0}
                  </span>
                  {" "}· {user.rank || "Beginner"} · {user.city || "Trekker"}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Link
                  href="/explore"
                  className="hidden sm:inline-flex items-center gap-2 border border-white/10 hover:border-white/20 bg-white/5 text-white/80 hover:text-white px-4 py-2.5 rounded-full text-sm font-medium transition-colors"
                >
                  <Compass className="w-4 h-4 text-emerald-400" />
                  Explore Trails
                </Link>
                <button
                  onClick={() => setShowModal(true)}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Log a Trek
                </button>
              </div>
            </div>

            {/* TWO COLUMNS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

              {/* LEFT COLUMN */}
              <div className="lg:col-span-2 space-y-6">

                {/* AI Recommendation */}
                {recommended ? (
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
                          Recommended based on terrain data and real trail metrics.
                        </p>
                      </div>

                      <div className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border shrink-0 ${difficultyColor[recommended.difficulty] || "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}`}>
                        <Compass className="w-3.5 h-3.5" />
                        {recommended.difficulty || "Recommended"}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                    <Compass className="w-8 h-8 text-emerald-400/60 mx-auto mb-2" />
                    <h3 className="text-white font-semibold">Discover Your Next Trek</h3>
                    <p className="text-white/40 text-sm mt-1 mb-4">
                      Explore over thousands of trails with live weather and safety metrics.
                    </p>
                    <Link
                      href="/explore"
                      className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-xl transition-colors"
                    >
                      Browse Trails →
                    </Link>
                  </div>
                )}

                {/* Community & Activity Feed */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-blue-400" />
                      <h2 className="text-white font-semibold">Community Treks & Groups</h2>
                    </div>
                    <Link
                      href="/groups"
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  {recentGroups.length > 0 ? (
                    <div className="space-y-3">
                      {recentGroups.map((g) => (
                        <Link
                          key={g.id}
                          href={`/groups/${g.id}`}
                          className="flex items-center justify-between p-3.5 bg-black/40 border border-white/5 hover:border-emerald-500/30 rounded-xl transition-colors block"
                        >
                          <div>
                            <p className="text-white text-sm font-medium">{g.title}</p>
                            <div className="flex items-center gap-3 text-white/40 text-xs mt-1">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" /> {g.location}
                              </span>
                              {g.start_date && (
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-3 h-3" /> {new Date(g.start_date).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-emerald-400 text-sm font-semibold">
                              {g.cost === 0 ? "Free" : `₹${g.cost.toLocaleString()}`}
                            </span>
                            <p className="text-white/30 text-xs">{g.member_count} joined</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-black/30 border border-dashed border-white/10 rounded-xl">
                      <p className="text-white/40 text-sm">No active trek groups right now.</p>
                      <Link
                        href="/groups/create"
                        className="inline-block mt-3 text-xs text-emerald-400 hover:text-emerald-300 underline"
                      >
                        Be the first to host a trek group →
                      </Link>
                    </div>
                  )}
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

                  {leaderboard.length > 0 ? (
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
                            {person.name ? person.name.split(" ").map((n: string) => n[0]).join("") : "U"}
                          </div>

                          <span className={`text-sm flex-1 ${
                            person.username === user.username
                              ? "text-emerald-400 font-semibold"
                              : "text-white/70"
                          }`}>
                            {person.username === user.username ? "You" : (person.name || person.username).split(" ")[0]}
                          </span>

                          <span className="text-sm text-white/50 font-mono">
                            {person.trail_score ? person.trail_score.toLocaleString() : 0}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 px-3 bg-black/30 border border-dashed border-white/10 rounded-xl">
                      <p className="text-white/50 text-xs">No trekkers ranked in {user.city} yet.</p>
                      <p className="text-white/30 text-[11px] mt-1">Log a trek to claim the #1 spot!</p>
                    </div>
                  )}
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
          </>
        )}
      </main>

      {/* LOG TREK MODAL */}
      {showModal && user && (
        <LogTrekModal
          username={user.username}
          onClose={() => setShowModal(false)}
          onSuccess={fetchDashboard}
        />
      )}
    </div>
  )
}