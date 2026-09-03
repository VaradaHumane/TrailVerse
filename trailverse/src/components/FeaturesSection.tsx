"use client"

import {
  Brain,        // AI recommendation icon
  Trophy,       // Trail Score icon
  Users,        // Community icon
  Camera,       // Content creator icon
  Shield,       // Risk predictor icon
  Map,          // Route intelligence icon
} from "lucide-react"

// This is our data — an array of objects, one per feature card
// Keeping data separate from UI is good practice (interviewers love this)
const features = [
  {
    icon: Brain,
    title: "AI Trek Recommendations",
    description:
      "Our Random Forest + XGBoost model analyzes your fitness, experience, location and weather to suggest the perfect trek for you.",
    color: "text-purple-400",
    bg: "bg-purple-400/10 border-purple-400/20",
  },
  {
    icon: Trophy,
    title: "Trail Score & Rankings",
    description:
      "Earn points for every trek. Climb city, state and national leaderboards. Your score updates the moment you log a trek.",
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20",
  },
  {
    icon: Shield,
    title: "Trek Risk Predictor",
    description:
      "AI-powered safety ratings using live weather data, rainfall, wind speed and trail difficulty. Know before you go.",
    color: "text-red-400",
    bg: "bg-red-400/10 border-red-400/20",
  },
  {
    icon: Users,
    title: "Trek Groups & Events",
    description:
      "Create or join trekking groups. Leaders post events, share GPX routes, and manage RSVPs — all in one place.",
    color: "text-blue-400",
    bg: "bg-blue-400/10 border-blue-400/20",
  },
  {
    icon: Camera,
    title: "Content Creator Mode",
    description:
      "Upload reels and photos. AI writes captions and hashtags for you. Predict your reel's reach before you post.",
    color: "text-pink-400",
    bg: "bg-pink-400/10 border-pink-400/20",
  },
  {
    icon: Map,
    title: "Route Intelligence",
    description:
      "Upload a GPX file and instantly get distance, elevation gain, estimated calories burned and average pace.",
    color: "text-amber-400",
    bg: "bg-amber-400/10 border-amber-400/20",
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
                {/* Icon container */}
                <div className={`w-12 h-12 rounded-xl border flex items-center justify-center mb-4 ${feature.bg}`}>
                  <Icon className={`w-6 h-6 ${feature.color}`} />
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
      </div>
    </section>
  )
}