"use client"

import Link from "next/link"
import {
  Wallet,
  Brain,
  Trophy,
  Users,
  Shield,
  Search,
} from "lucide-react"

const features = [
  {
    icon: Wallet,
    title: "Group Expense & Permit Splitter",
    description:
      "Split cab fares, campsite rentals, and track forest permits. Features automated debt minimization and 1-click UPI payments (GPay, PhonePe, Paytm).",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
    badge: "NEW",
  },
  {
    icon: Search,
    title: "Dynamic Global Search Engine",
    description:
      "Instant, live search across 27+ curated trails, mountain regions, difficulty tiers, and fellow community trekkers with real-time results.",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
    badge: "FAST",
  },
  {
    icon: Brain,
    title: "AI Trek Recommendations",
    description:
      "Random Forest + XGBoost models analyze your fitness, experience, elevation profile, and weather to suggest the perfect trail for you.",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
  {
    icon: Trophy,
    title: "Trail Score & City Rankings",
    description:
      "Earn verified points for every logged summit. Climb city and regional leaderboards as your trail score updates instantaneously.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10 border-yellow-400/20",
  },
  {
    icon: Shield,
    title: "Trek Risk & Weather Predictor",
    description:
      "AI-powered safety ratings analyzing real-time mountain weather, rainfall, wind speeds, and trail difficulty before you step out.",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
  {
    icon: Users,
    title: "Trek Groups, RSVPs & Forums",
    description:
      "Create or join expeditions. Hosts post announcements, manage RSVPs, answer route questions, and plan itineraries collaboratively.",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
]

export default function FeaturesSection() {
  return (
    // id="features" lets the navbar "Features" link scroll here
    <section id="features" className="bg-black py-24 px-6">

      <div className="max-w-6xl mx-auto">

        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-emerald-400 text-sm font-medium uppercase tracking-widest mb-3">
            Everything in one place
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Built for serious trekkers
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">
            Stop juggling five apps. TrailVerse brings AI, community,
            and your entire trek history under one roof.
          </p>
        </div>

        {/* Feature cards grid */}
        {/*
          grid                → CSS grid layout
          grid-cols-1         → 1 column on mobile
          md:grid-cols-2      → 2 columns on tablet
          lg:grid-cols-3      → 3 columns on desktop
          gap-6               → 24px gap between cards
        */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

          {features.map((feature) => {
            // Destructure each feature object into individual variables
            const Icon = feature.icon  // capital I because it's used as a component

            return (
              <div
                key={feature.title}
                className="group border border-white/10 rounded-2xl p-6 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 cursor-pointer"
                // group → lets child elements react to hover on the parent
              >
                {/* Icon container & badge */}
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-12 h-12 rounded-xl border flex items-center justify-center ${feature.bg}`}>
                    <Icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  {feature.badge && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">
                      {feature.badge}
                    </span>
                  )}
                </div>

                {/* Card title */}
                <h3 className="text-white font-semibold text-lg mb-2 group-hover:text-emerald-400 transition-colors">
                  {feature.title}
                </h3>

                {/* Card description */}
                <p className="text-white/50 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            )
          })}

        </div>

        {/* View all features link */}
        <div className="text-center mt-12">
          <Link
            href="/features"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/40 text-white text-sm font-semibold transition-all hover:scale-105"
          >
            <span>Explore All Platform Features & Roadmap</span>
            <span className="text-emerald-400">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}