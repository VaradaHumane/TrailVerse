"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  TrendingUp,
  Users,
  Compass,
  Calendar,
  MapPin,
  ArrowRight,
  Wallet,
  Sparkles,
  Search,
  CheckCircle2,
  Trophy,
  Brain,
  Shield,
  Smartphone,
  Share2,
  Map,
} from "lucide-react"
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
  const [activeTab, setActiveTab] = useState<"overview" | "features">("overview")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (params.get("tab") === "features" || window.location.hash === "#features") {
        setActiveTab("features")
      }
    }
  }, [])

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

            {/* DASHBOARD NAVIGATION TABS */}
            <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-8">
              <button
                onClick={() => setActiveTab("overview")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  activeTab === "overview"
                    ? "bg-white/10 text-white border border-white/20 shadow-sm"
                    : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <span>📊</span>
                <span>Overview</span>
              </button>

              <button
                onClick={() => setActiveTab("features")}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all relative ${
                  activeTab === "features"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm shadow-emerald-500/10"
                    : "text-white/50 hover:text-white hover:bg-white/5 border border-transparent"
                }`}
              >
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Features & Platform Tools</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-emerald-300">
                  NEW
                </span>
              </button>
            </div>

            {activeTab === "overview" ? (
              <>
                {/* NEW FEATURE HIGHLIGHT BANNER */}
                <div className="mb-6 bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-bold text-sm sm:text-base">Group Expense & Permit Splitter</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                          NEW
                        </span>
                      </div>
                      <p className="text-white/50 text-xs mt-0.5">
                        Split shared cabs, stays, and permits with automated debt minimization & 1-click UPI payments (GPay/PhonePe/Paytm).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/groups"
                      className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2 rounded-xl transition-colors shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                    >
                      <span>Try in Groups</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
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
                        <div className="text-center py-6 bg-black/30 border border-dashed border-white/10 rounded-xl">
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
            ) : (
              /* FEATURES & PLATFORM TOOLS TAB */
              <div className="space-y-10 animate-in fade-in">
                {/* Implemented Features Grid */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                        Active & Implemented Features
                      </h2>
                      <p className="text-white/40 text-xs mt-0.5">Explore built-in capabilities available in TrailVerse right now</p>
                    </div>

                    <Link
                      href="/features"
                      className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1"
                    >
                      Full Details <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* Feature 1: Group Expense Splitter */}
                    <div className="bg-white/5 border border-emerald-500/30 rounded-2xl p-5 flex flex-col justify-between hover:border-emerald-500/50 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                            <Wallet className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                            NEW
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">Group Expense & Permit Splitter</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Log shared cabs, stays, and permits. Includes greedy debt minimization and 1-click UPI payments (GPay/PhonePe/Paytm).
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-emerald-400 font-medium">Ready in Groups</span>
                        <Link
                          href="/groups"
                          className="text-xs font-semibold text-white hover:text-emerald-400 flex items-center gap-1"
                        >
                          Open Groups →
                        </Link>
                      </div>
                    </div>

                    {/* Feature 2: Dynamic Global Search */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center">
                            <Search className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            CORE
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">Dynamic Global Search Engine</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Search across 27+ curated trails, difficulty grades, regions, and community trekkers with real-time feedback.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">27+ Trails Indexed</span>
                        <Link
                          href="/explore"
                          className="text-xs font-semibold text-white hover:text-amber-400 flex items-center gap-1"
                        >
                          Explore Trails →
                        </Link>
                      </div>
                    </div>

                    {/* Feature 3: Google OAuth */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40">
                            AUTH
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">One-Click Google & Supabase Login</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Frictionless OAuth 2.0 login with automatic user profiling, secure JWT tokens, and zero password hassles.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">OAuth 2.0</span>
                        <Link
                          href={`/profile/${user.username}`}
                          className="text-xs font-semibold text-white hover:text-blue-400 flex items-center gap-1"
                        >
                          View Profile →
                        </Link>
                      </div>
                    </div>

                    {/* Feature 4: AI Trek Recommendations */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center">
                            <Brain className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            AI/ML
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">AI Trek Recommendation Engine</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Personalized trail recommendations evaluating user fitness score, elevation gradients, and risk tolerances.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">Random Forest + XGB</span>
                        <button
                          onClick={() => setActiveTab("overview")}
                          className="text-xs font-semibold text-white hover:text-purple-400 flex items-center gap-1"
                        >
                          See Recommendation →
                        </button>
                      </div>
                    </div>

                    {/* Feature 5: Trek Groups & Forums */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 text-pink-400 flex items-center justify-center">
                            <Users className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-pink-500/20 text-pink-300 border border-pink-500/40">
                            COMMUNITY
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">Trek Groups, RSVPs & Forums</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Plan weekend expeditions, post announcements, discuss gear requirements, and ask trek organizers questions.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">RSVPs & Q&A</span>
                        <Link
                          href="/groups"
                          className="text-xs font-semibold text-white hover:text-pink-400 flex items-center gap-1"
                        >
                          Explore Groups →
                        </Link>
                      </div>
                    </div>

                    {/* Feature 6: City Leaderboard & Trail Score */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col justify-between hover:border-white/20 transition-colors">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 flex items-center justify-center">
                            <Trophy className="w-5 h-5" />
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                            SCORE
                          </span>
                        </div>
                        <div>
                          <h3 className="text-white font-bold text-sm">Trail Score & City Leaderboards</h3>
                          <p className="text-white/50 text-xs mt-1 leading-relaxed">
                            Gain points for summits, conquer altitude badges, and compete with trekkers across your home city.
                          </p>
                        </div>
                      </div>
                      <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-[11px] text-white/40">Score: {user.trail_score}</span>
                        <button
                          onClick={() => setShowModal(true)}
                          className="text-xs font-semibold text-white hover:text-yellow-400 flex items-center gap-1"
                        >
                          Log a Trek +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Upcoming Roadmap Features */}
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-4 h-4 text-purple-400" />
                    <h2 className="text-lg font-bold text-white">Upcoming In TrailVerse Roadmap</h2>
                    <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full ml-auto">
                      Currently In Engineering
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                        <Compass className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm">Solo Trekker Matchmaker (&quot;Trek Buddy&quot;)</h4>
                          <span className="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">Up Next</span>
                        </div>
                        <p className="text-white/50 text-xs mt-1">
                          Find companions for weekend treks matching your pace, departure city, and preferred dates.
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                        <Map className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm">Interactive OpenStreetMap Explorer</h4>
                          <span className="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">Up Next</span>
                        </div>
                        <p className="text-white/50 text-xs mt-1">
                          Interactive Leaflet/OSM map with altitude heatmaps, danger pins, and real-time weather risk popups.
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                        <Smartphone className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm">Offline Trail Mode (PWA & Cached Dossier)</h4>
                          <span className="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">Up Next</span>
                        </div>
                        <p className="text-white/50 text-xs mt-1">
                          Installable PWA that caches trail GPS points, offline maps, and emergency SOS hospital contacts.
                        </p>
                      </div>
                    </div>

                    <div className="bg-black/40 border border-purple-500/20 rounded-2xl p-4 flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                        <Share2 className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-white font-bold text-sm">Summit Achievement Card Generator</h4>
                          <span className="text-[9px] text-purple-300 bg-purple-500/20 px-1.5 py-0.5 rounded">Up Next</span>
                        </div>
                        <p className="text-white/50 text-xs mt-1">
                          Exportable high-res social cards with trek distance, elevation gain, summit badges, and Trail Score.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
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