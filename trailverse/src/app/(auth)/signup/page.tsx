"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mountain, Eye, EyeOff, Check } from "lucide-react"
import { signupUser } from "@/lib/api"

const INDIAN_CITIES = [
  "Mumbai", "Pune", "Delhi", "Bangalore", "Chennai",
  "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Nagpur"
]

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [error, setError]               = useState("")
  const [formData, setFormData] = useState({
    name: "", email: "", password: "", city: "", username: "",
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      await signupUser(formData)
      // Store username in localStorage so dashboard knows who's logged in
      localStorage.setItem("username", formData.username)
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  const passwordStrength = () => {
    const p = formData.password
    if (p.length === 0) return -1
    if (p.length < 6) return 0
    if (p.length < 10) return 1
    return 2
  }

  const strengthLabel = ["Weak", "Medium", "Strong"]
  const strengthColor = ["bg-red-500", "bg-amber-400", "bg-emerald-500"]

  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6 py-12">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white font-bold text-2xl">
            <Mountain className="w-8 h-8 text-emerald-400" />
            TrailVerse
          </Link>
          <p className="text-white/40 text-sm mt-2">Create your trekker profile</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
          <h1 className="text-white text-2xl font-bold mb-6">Join TrailVerse</h1>

          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-white/70 text-sm mb-2">Full name</label>
              <input
                name="name" type="text" required
                value={formData.name} onChange={handleChange}
                placeholder="Varada Joshi"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Username</label>
              <input
                name="username" type="text" required
                value={formData.username} onChange={handleChange}
                placeholder="varada"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Email</label>
              <input
                name="email" type="email" required
                value={formData.email} onChange={handleChange}
                placeholder="you@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">City</label>
              <select
                name="city" required
                value={formData.city} onChange={handleChange}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              >
                <option value="" disabled>Select your city</option>
                {INDIAN_CITIES.map((city) => (
                  <option key={city} value={city} className="bg-black">{city}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Password</label>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {formData.password.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= passwordStrength()
                            ? strengthColor[passwordStrength()]
                            : "bg-white/10"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-white/40">
                    Strength: <span className="text-white/70">{strengthLabel[passwordStrength()] ?? ""}</span>
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {[
                "Free trekker profile with Trail Score",
                "AI trek recommendations from day one",
                "Join 10,000+ trekkers across India",
              ].map((perk) => (
                <div key={perk} className="flex items-center gap-2 text-white/50 text-sm">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {perk}
                </div>
              ))}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2"
            >
              {loading ? "Creating profile..." : "Create my profile"}
            </button>

          </form>
        </div>

        <p className="text-center text-white/40 text-sm mt-6">
          Already have an account?{" "}
          <Link href="/login" className="text-emerald-400 hover:text-emerald-300 transition-colors font-medium">
            Log in
          </Link>
        </p>
      </div>
    </div>
  )
}