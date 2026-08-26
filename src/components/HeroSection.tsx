"use client"

import Link from "next/link"
import { ArrowRight, Star } from "lucide-react"

export default function HeroSection() {
  return (
    // min-h-screen → takes up at least the full viewport height
    // pt-16 → padding top 64px (to account for the fixed navbar)
    // relative → lets us position child elements absolutely inside
    <section className="min-h-screen bg-black relative flex items-center justify-center overflow-hidden">

      {/* Background gradient blob — purely decorative */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/30 via-black to-black pointer-events-none" />

      {/* Glowing circle behind the text */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main content — relative so it sits above the background blobs */}
      <div className="relative z-10 text-center px-6 max-w-4xl mx-auto">

        {/* Small badge at the top */}
        <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1 rounded-full mb-6">
          <Star className="w-3 h-3 fill-current" />
          India's first professional trekking network
        </div>

        {/* Main headline */}
        <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight mb-6">
          Your trekking journey,{" "}
          {/* text-emerald-400 → green color for emphasis */}
          <span className="text-emerald-400">professionally tracked</span>
        </h1>

        {/* Subheadline */}
        <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-10 leading-relaxed">
          Build your trekker profile. Get AI-powered trek recommendations.
          Join a community of 10,000+ trekkers across India.
        </p>

        {/* Call to action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-8 py-4 rounded-full transition-all text-lg"
          >
            Start your journey
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#features"
            className="inline-flex items-center justify-center gap-2 border border-white/20 hover:border-white/40 text-white/80 hover:text-white font-medium px-8 py-4 rounded-full transition-all text-lg"
          >
            See features
          </Link>
        </div>

        {/* Social proof numbers */}
        <div className="mt-16 flex flex-col sm:flex-row gap-8 justify-center">
          {[
            { number: "10,000+", label: "Trekkers" },
            { number: "500+", label: "Trails mapped" },
            { number: "₹0", label: "Always free" },
          ].map((stat) => (
            // .map() loops through the array and creates a component for each item
            <div key={stat.label} className="text-center">
              <div className="text-3xl font-bold text-white">{stat.number}</div>
              <div className="text-sm text-white/50 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}