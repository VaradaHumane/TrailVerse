import Link from "next/link"
import { Mountain } from "lucide-react"

export default function Footer() {
  return (
    <footer className="bg-black border-t border-white/10 py-12 px-6">
      <div className="max-w-6xl mx-auto">

        {/* Top row: logo + links */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">

          {/* Logo + tagline */}
          <div>
            <div className="flex items-center gap-2 text-white font-bold text-xl mb-2">
              <Mountain className="w-6 h-6 text-emerald-400" />
              TrailVerse
            </div>
            <p className="text-white/40 text-sm max-w-xs">
              The professional network for trekkers. Track, share, and grow.
            </p>
          </div>

          {/* Link columns */}
          {/* <div className="flex gap-16">
            <div>
              <p className="text-white text-sm font-semibold mb-3">Product</p>
              {["Features", "Rankings", "Community", "AI Tools"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="block text-white/40 text-sm hover:text-white transition-colors mb-2"
                >
                  {item}
                </Link>
              ))}
            </div>
            <div>
              <p className="text-white text-sm font-semibold mb-3">Company</p>
              {["About", "Blog", "Careers", "Contact"].map((item) => (
                <Link
                  key={item}
                  href="#"
                  className="block text-white/40 text-sm hover:text-white transition-colors mb-2"
                >
                  {item}
                </Link>
              ))}
            </div>
          </div> */}
        </div>

        {/* Bottom row: copyright */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-2">
          <p className="text-white/30 text-sm">
            Made for trekkers, by trekkers 🏔
          </p>
        </div>

      </div>
    </footer>
  )
}