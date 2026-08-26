// This is a React component — a reusable piece of UI
// "use client" means this runs in the browser (not on the server)
"use client"

import Link from "next/link"        // Next.js link — like <a> but faster
import { Mountain } from "lucide-react"  // icon from lucide

export default function Navbar() {
  return (
    // <nav> is the HTML element for navigation bars
    // className uses Tailwind CSS classes — each class is one style rule
    <nav className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md fixed top-0 z-50">
      {/* 
        w-full       → width: 100%
        border-b     → border on the bottom only
        bg-black/80  → black background at 80% opacity
        backdrop-blur-md → blurs what's behind the navbar (glass effect)
        fixed top-0  → sticks to the top of the screen while scrolling
        z-50         → sits on top of everything else (z-index: 50)
      */}

      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/*
          max-w-6xl    → limits content width so it doesn't stretch too wide
          mx-auto      → centers it horizontally
          px-6         → padding left and right
          h-16         → height of 64px
          flex         → makes children sit side by side
          items-center → vertically centers children
          justify-between → pushes logo left, links right
        */}

        {/* LEFT SIDE: Logo */}
        <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
          <Mountain className="w-6 h-6 text-emerald-400" />
          TrailVerse
        </Link>

        {/* RIGHT SIDE: Nav links */}
        <div className="flex items-center gap-6">
          <Link href="/explore" className="text-sm text-white/70 hover:text-white transition-colors">
            Explore
          </Link>
          <Link href="#features" className="text-sm text-white/70 hover:text-white transition-colors">
            Features
          </Link>
          <Link href="#community" className="text-sm text-white/70 hover:text-white transition-colors">
            Community
          </Link>
          <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">
            Log in
          </Link>
          {/* <Link href="/groups" className="text-sm text-white/70 hover:text-white transition-colors">
            Groups
          </Link> */}
          <Link
            href="/signup"
            className="text-sm bg-emerald-500 hover:bg-emerald-400 text-white px-4 py-2 rounded-full transition-colors font-medium"
          >
            Join free
          </Link>
          {/* <Link href="/dashboard" className="text-sm text-white/70 hover:text-white transition-colors">
            Dashboard
          </Link> */}
        </div>
      </div>
    </nav>
  )
}