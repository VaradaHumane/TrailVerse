"use client"

import Link from "next/link"
import {
  Wallet,
  Compass,
  Search,
  Users,
  Brain,
  Trophy,
  Map,
  Smartphone,
  Share2,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react"
import Navbar from "@/components/Navbar"
import Footer from "@/components/Footer"

export default function FeaturesPage() {
  const implementedFeatures = [
    {
      id: "expense-splitter",
      icon: Wallet,
      badge: "Newly Added",
      title: "Group Trek Expense & Permit Splitter",
      description:
        "Split cab fares, campsite rentals, food costs, guide fees, and track forest department entry permits. Features automatic greedy debt minimization and 1-click UPI payments (GPay/PhonePe/Paytm) with host payment setup.",
      status: "Active & Implemented",
      category: "Group Logistics",
      actionText: "Try in Trek Groups",
      actionHref: "/groups",
      highlightColor: "text-emerald-400",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    },
    {
      id: "google-auth",
      icon: CheckCircle2,
      badge: "Core System",
      title: "One-Click Google & Supabase Login",
      description:
        "Seamless OAuth login with your Google account via Supabase built-in authentication. Zero password fatigue, secure sessions, and automatic profile creation.",
      status: "Active & Implemented",
      category: "Authentication",
      actionText: "Go to Dashboard",
      actionHref: "/dashboard",
      highlightColor: "text-blue-400",
      badgeColor: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    },
    {
      id: "global-search",
      icon: Search,
      badge: "Real-Time",
      title: "Dynamic Global Search Engine",
      description:
        "Lightning-fast search across 27+ curated treks, mountain locations, difficulty levels, and fellow community trekkers. Includes live keyboard navigation and instant route links.",
      status: "Active & Implemented",
      category: "Discovery",
      actionText: "Explore All Trails",
      actionHref: "/explore",
      highlightColor: "text-amber-400",
      badgeColor: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    },
    {
      id: "trek-groups",
      icon: Users,
      badge: "Community",
      title: "Trek Groups, RSVPs & Discussion Forums",
      description:
        "Create or join community trek expeditions. Host leaders publish announcements, manage member RSVPs, answer route questions, and coordinate trail itineraries.",
      status: "Active & Implemented",
      category: "Community",
      actionText: "Browse Groups",
      actionHref: "/groups",
      highlightColor: "text-indigo-400",
      badgeColor: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    },
    {
      id: "ai-recommendations",
      icon: Brain,
      badge: "Machine Learning",
      title: "AI Trek Recommendations & Risk Predictor",
      description:
        "Trained models evaluate your fitness score, experience level, elevation profile, and real-time mountain weather hazards to suggest safe, customized trails.",
      status: "Active & Implemented",
      category: "Intelligence",
      actionText: "View Recommendations",
      actionHref: "/dashboard",
      highlightColor: "text-purple-400",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    },
    {
      id: "leaderboards",
      icon: Trophy,
      badge: "Gamification",
      title: "Trail Score & City Leaderboards",
      description:
        "Earn trail score points with every summit logged. Compete across home cities (Pune, Mumbai, Bengaluru, etc.) and unlock verified trekker achievement badges.",
      status: "Active & Implemented",
      category: "Gamification",
      actionText: "Check Rankings",
      actionHref: "/dashboard",
      highlightColor: "text-yellow-400",
      badgeColor: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
    },
  ]

  const upcomingFeatures = [
    {
      id: "matchmaker",
      icon: Compass,
      badge: "Up Next",
      title: "Solo Trekker Matchmaker ('Trek Buddy')",
      description:
        "No buddy for the weekend? Find companions matching your pace, departure city, and dates (e.g., 'Looking for 2 buddies for Rajmachi this Saturday · Moderate pace · Pune').",
      status: "In Development",
      category: "Matchmaking",
    },
    {
      id: "interactive-map",
      icon: Map,
      badge: "Up Next",
      title: "Interactive OpenStreetMap Trail Explorer",
      description:
        "Interactive Leaflet/OSM map with live elevation heatmaps, difficulty pins, trail waypoints, and real-time weather risk popups across Indian mountain ranges.",
      status: "In Development",
      category: "Navigation",
    },
    {
      id: "offline-pwa",
      icon: Smartphone,
      badge: "Up Next",
      title: "Offline Trail Mode (PWA & Cached Emergency Dossier)",
      description:
        "Installable Progressive Web App caching trail GPS coordinates, offline maps, weather warnings, and local emergency SOS hospital numbers for zero-connectivity valleys.",
      status: "In Development",
      category: "Offline & Safety",
    },
    {
      id: "summit-card",
      icon: Share2,
      badge: "Up Next",
      title: "Summit Achievement Card Generator",
      description:
        "Exportable high-resolution social cards showcasing trek distance, elevation gain, summit badges, and Trail Score to share on Instagram and WhatsApp.",
      status: "In Development",
      category: "Social",
    },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <Navbar />

      <main className="flex-1 max-w-6xl mx-auto px-6 pt-28 pb-20 w-full">
        {/* HERO TITLE */}
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TrailVerse Capabilities & Architecture</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">
            Features & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Platform Tools</span>
          </h1>

          <p className="text-white/60 text-base sm:text-lg leading-relaxed">
            Everything designed for high-altitude explorers, weekend trekkers, and community trip leaders.
            Explore all live features and see what is rolling out next.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <a
              href="#implemented"
              className="text-xs px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 transition-colors font-medium"
            >
              ✅ Active Features ({implementedFeatures.length})
            </a>
            <a
              href="#roadmap"
              className="text-xs px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white transition-colors font-medium"
            >
              🚀 In Development ({upcomingFeatures.length})
            </a>
          </div>
        </div>

        {/* ACTIVE & IMPLEMENTED SECTION */}
        <section id="implemented" className="mb-20 scroll-mt-28">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Active & Implemented Features</h2>
              <p className="text-white/40 text-xs mt-0.5">Live in production and ready to use across TrailVerse</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {implementedFeatures.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.id}
                  className="bg-white/5 border border-white/10 hover:border-white/20 rounded-2xl p-6 flex flex-col justify-between transition-all hover:translate-y-[-2px] group"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${feat.highlightColor}`}>
                        <Icon className="w-6 h-6" />
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${feat.badgeColor}`}>
                        {feat.badge}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-white/30 block mb-1">
                        {feat.category}
                      </span>
                      <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">
                        {feat.title}
                      </h3>
                      <p className="text-white/50 text-xs leading-relaxed mt-2">
                        {feat.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {feat.status}
                    </span>

                    <Link
                      href={feat.actionHref}
                      className="inline-flex items-center gap-1 text-xs text-white/80 hover:text-white font-medium group-hover:underline"
                    >
                      {feat.actionText}
                      <ArrowRight className="w-3 h-3 text-emerald-400 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* UPCOMING ROADMAP SECTION */}
        <section id="roadmap" className="scroll-mt-28">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center font-bold">
              🚀
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Upcoming Features & Roadmap</h2>
              <p className="text-white/40 text-xs mt-0.5">Currently being engineered for upcoming releases</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {upcomingFeatures.map((feat) => {
              const Icon = feat.icon
              return (
                <div
                  key={feat.id}
                  className="bg-black/40 border border-purple-500/20 rounded-2xl p-6 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{feat.title}</h3>
                        <span className="text-[10px] text-purple-300/60 uppercase tracking-wider">{feat.category}</span>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 shrink-0">
                      {feat.badge}
                    </span>
                  </div>

                  <p className="text-white/50 text-xs leading-relaxed">
                    {feat.description}
                  </p>
                </div>
              )
            })}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
