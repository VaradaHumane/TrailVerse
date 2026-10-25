"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Mountain, MapPin, Calendar, Award, TrendingUp, Compass, Plus } from "lucide-react"
import Link from "next/link"
import { getUserProfile, getUserGroups } from "@/lib/api"
import Navbar from "@/components/Navbar"

// ── Types matching your API response ──
type Trek = {
  id: string
  date: string
  duration_mins: number
  treks: {
    name: string
    difficulty: string
    distance_km: number
    location: string
  }
}

type Badge = {
  id: string
  earned_at: string
  badges: {
    title: string
    icon: string
    description: string
  }
}

type User = {
  name: string
  username: string
  city: string
  bio: string
  trail_score: number
  rank: string
  created_at: string
}

type GroupSummary = {
  id: string
  title: string
  location: string
  cost: number
  start_date: string | null
}

const difficultyColor: Record<string, string> = {
  Easy:   "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  Medium: "text-amber-400   bg-amber-400/10   border-amber-400/20",
  Hard:   "text-red-400     bg-red-400/10     border-red-400/20",
}

const rankColor: Record<string, string> = {
  Beginner:     "text-slate-400  bg-slate-400/10  border-slate-400/20",
  Intermediate: "text-blue-400   bg-blue-400/10   border-blue-400/20",
  Expert:       "text-purple-400 bg-purple-400/10 border-purple-400/20",
  Elite:        "text-amber-400  bg-amber-400/10  border-amber-400/20",
}

export default function ProfilePage() {
  const params = useParams()
  const username = params.username as string

  // useState to store the API data
  const [user, setUser]               = useState<User | null>(null)
  const [trekHistory, setTrekHistory] = useState<Trek[]>([])
  const [badges, setBadges]           = useState<Badge[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState("")

  const [hostedGroups, setHostedGroups] = useState<GroupSummary[]>([])
  const [joinedGroups, setJoinedGroups] = useState<GroupSummary[]>([])

  // useEffect runs once when the page loads
  // It fetches real data from your FastAPI backend
  useEffect(() => {
    getUserProfile(username)
      .then((data) => {
        setUser(data.user)
        setTrekHistory(data.trek_history)
        setBadges(data.badges)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message || "Something went wrong")
        setLoading(false)
      })

    getUserGroups(username)
      .then((data) => {
        setHostedGroups(data.hosted_groups)
        setJoinedGroups(data.joined_groups)
      })
      .catch(() => {})
  }, [username])

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-5xl mx-auto px-6 pt-24 pb-16">
        {loading ? (
          /* SKELETON LOADING STATE FOR FAST TRANSITIONS */
          <div className="animate-pulse space-y-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 flex gap-6 items-center">
              <div className="w-20 h-20 rounded-full bg-white/10 shrink-0" />
              <div className="flex-1 space-y-3">
                <div className="h-7 w-48 bg-white/10 rounded-md" />
                <div className="h-4 w-36 bg-white/5 rounded-md" />
                <div className="h-4 w-72 bg-white/5 rounded-md" />
              </div>
              <div className="w-32 h-20 bg-white/5 rounded-xl shrink-0" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 h-20" />
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6 h-64" />
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 h-64" />
            </div>
          </div>
        ) : error || !user ? (
          <div className="min-h-[50vh] flex flex-col items-center justify-center text-center gap-4">
            <p className="text-red-400 text-lg">{error || "User not found"}</p>
            <Link
              href="/explore"
              className="bg-white/10 hover:bg-white/20 text-white text-sm px-5 py-2.5 rounded-xl transition-colors"
            >
              Back to Explore
            </Link>
          </div>
        ) : (
          <>
            {/* SECTION 1 — Identity */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-6">
              <div className="flex flex-col md:flex-row gap-6 items-start">
                <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-emerald-400 font-bold text-2xl shrink-0">
                  {user.name ? user.name.split(" ").map((n) => n[0]).join("") : "U"}
                </div>

                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-1">
                    <h1 className="text-2xl font-bold text-white">{user.name}</h1>
                    <span className={`text-xs px-2 py-1 rounded-full border font-medium ${rankColor[user.rank] || rankColor.Beginner}`}>
                      {user.rank || "Beginner"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-white/40 text-sm mb-3">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {user.city}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> Joined {user.created_at ? new Date(user.created_at).toLocaleDateString("en-IN", { month: "long", year: "numeric" }) : "Recently"}
                    </span>
                  </div>
                  <p className="text-white/60 text-sm">{user.bio || "Avid trekker exploring trails and summits."}</p>
                </div>

                <div className="text-center bg-black/40 border border-white/10 rounded-xl px-6 py-4 shrink-0">
                  <div className="text-xs text-white/40 mb-1 uppercase tracking-widest">Trail Score</div>
                  <div className="text-4xl font-bold text-emerald-400">{user.trail_score ? user.trail_score.toLocaleString() : 0}</div>
                  <div className="text-xs text-emerald-400/80 mt-1">{user.rank || "Beginner"} Level</div>
                </div>
              </div>
            </div>

            {/* SECTION 2 — Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                { label: "Total Treks",      value: trekHistory.length },
                { label: "Distance",         value: `${trekHistory.reduce((sum, t) => sum + (t.treks?.distance_km || 0), 0)} km` },
                { label: "Avg Duration",     value: trekHistory.length ? `${Math.round(trekHistory.reduce((sum, t) => sum + (t.duration_mins || 0), 0) / trekHistory.length)} min` : "—" },
                { label: "Badges Earned",    value: badges.length },
              ].map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                  <div className="text-xl font-bold text-white mb-1">{stat.value}</div>
                  <div className="text-xs text-white/40">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* SECTION 3 — Trek history + badges */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Trek history */}
              <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-white font-semibold">Trek History</h2>
                </div>
                {trekHistory.length === 0 ? (
                  <div className="text-center py-8 bg-black/30 border border-dashed border-white/10 rounded-xl">
                    <p className="text-white/40 text-sm">No treks logged yet.</p>
                    <p className="text-white/30 text-xs mt-1">Treks logged from your dashboard will appear here with distance and difficulty stats.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trekHistory.map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-3 border-b border-white/5 last:border-0">
                        <div>
                          <p className="text-white text-sm font-medium">{t.treks?.name}</p>
                          <p className="text-white/30 text-xs mt-0.5">
                            {new Date(t.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                            {" · "}{t.treks?.distance_km} km
                          </p>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded-full border ${difficultyColor[t.treks?.difficulty] || "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"}`}>
                          {t.treks?.difficulty || "Moderate"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Badges */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-5">
                  <Award className="w-4 h-4 text-emerald-400" />
                  <h2 className="text-white font-semibold">Badges</h2>
                </div>
                {badges.length === 0 ? (
                  <div className="text-center py-8 bg-black/30 border border-dashed border-white/10 rounded-xl">
                    <Award className="w-8 h-8 text-white/20 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">No badges unlocked yet.</p>
                    <p className="text-white/30 text-xs mt-1">Log treks to unlock achievements!</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {badges.map((b) => (
                      <div key={b.id} className="flex items-center gap-3">
                        <span className="text-2xl">{b.badges?.icon || "🏅"}</span>
                        <div>
                          <p className="text-white text-sm font-medium">{b.badges?.title}</p>
                          <p className="text-white/30 text-xs">{b.badges?.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* SECTION 4 — Trek Groups */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mt-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-emerald-400" />
              <h2 className="text-white font-semibold">Trek Groups</h2>
            </div>
            <Link
              href="/groups/create"
              className="flex items-center gap-1 text-emerald-400 text-sm hover:text-emerald-300"
            >
              <Plus className="w-3.5 h-3.5" />
              Host a Group
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Hosting</p>
              {hostedGroups.length === 0 ? (
                <p className="text-white/30 text-sm">Not hosting any groups</p>
              ) : (
                <div className="space-y-2">
                  {hostedGroups.map((g) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.id}`}
                      className="block bg-black/40 border border-white/10 rounded-lg px-4 py-3 hover:border-emerald-500/30 transition-colors"
                    >
                      <p className="text-white text-sm font-medium">{g.title}</p>
                      <p className="text-white/30 text-xs mt-0.5">{g.location}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="text-white/40 text-xs uppercase tracking-widest mb-3">Joined</p>
              {joinedGroups.length === 0 ? (
                <p className="text-white/30 text-sm">Not part of any groups yet</p>
              ) : (
                <div className="space-y-2">
                  {joinedGroups.map((g) => (
                    <Link
                      key={g.id}
                      href={`/groups/${g.id}`}
                      className="block bg-black/40 border border-white/10 rounded-lg px-4 py-3 hover:border-emerald-500/30 transition-colors"
                    >
                      <p className="text-white text-sm font-medium">{g.title}</p>
                      <p className="text-white/30 text-xs mt-0.5">{g.location}</p>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
  )
}