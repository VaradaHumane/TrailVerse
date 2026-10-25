"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Mountain, Eye, EyeOff, Check, Loader2, AlertCircle, ExternalLink } from "lucide-react"
import { signupUser } from "@/lib/api"
import { supabase } from "@/lib/supabaseClient"

const INDIAN_CITIES = [
  "Mumbai", "Pune", "Delhi", "Bangalore", "Chennai",
  "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Nagpur",
  "Dehradun", "Shimla", "Manali", "Rishikesh", "Srinagar"
]

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading]           = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [showSetupGuide, setShowSetupGuide] = useState(false)
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
      localStorage.setItem("username", formData.username)
      window.dispatchEvent(new Event("storage"))
      router.push("/dashboard")
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Signup failed")
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignup = async () => {
    setError("")
    setGoogleLoading(true)
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          skipBrowserRedirect: true,
        },
      })
      if (oauthError) throw oauthError

      if (data?.url) {
        try {
          const probe = await fetch(data.url)
          if (!probe.ok) {
            const errJson = await probe.json().catch(() => null)
            if (errJson?.msg?.includes("provider is not enabled") || errJson?.error_code === "validation_failed") {
              throw new Error("PROVIDER_NOT_ENABLED")
            }
            throw new Error(errJson?.msg || "Google signup failed")
          }
          window.location.href = data.url
        } catch (probeErr: unknown) {
          if (probeErr instanceof Error && probeErr.message === "PROVIDER_NOT_ENABLED") {
            setShowSetupGuide(true)
            setGoogleLoading(false)
            return
          }
          window.location.href = data.url
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to initiate Google sign up")
      setGoogleLoading(false)
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
          <Link href="/" className="inline-flex items-center gap-2 text-white font-bold text-2xl hover:opacity-90 transition-opacity">
            <Mountain className="w-8 h-8 text-emerald-400" />
            TrailVerse
          </Link>
          <p className="text-white/40 text-sm mt-2">Create your trekker profile</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <h1 className="text-white text-2xl font-bold mb-2">Join TrailVerse</h1>
          <p className="text-white/50 text-sm mb-6">Create a free profile to track treks and connect</p>

          {/* GOOGLE SIGN UP BUTTON */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading || loading}
            className="w-full border border-white/15 hover:border-emerald-500/40 bg-white/10 hover:bg-white/15 text-white font-medium py-3 rounded-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed group shadow-sm mb-6"
          >
            {googleLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
                <span>Redirecting to Google...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 transition-transform group-hover:scale-105" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>

          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-white/30 text-xs uppercase tracking-wider">or sign up with email</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-2">Full name</label>
              <input
                name="name" type="text" required
                value={formData.name} onChange={handleChange}
                placeholder="Alex Morgan"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-2">Username</label>
              <input
                name="username" type="text" required
                value={formData.username} onChange={handleChange}
                placeholder="alexmorgan"
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
                "Free trekker profile with live Trail Score",
                "Trek safety & weather intelligence",
                "Connect with active trekkers worldwide",
              ].map((perk) => (
                <div key={perk} className="flex items-center gap-2 text-white/50 text-sm">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  {perk}
                </div>
              ))}
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors mt-2 shadow-lg shadow-emerald-500/20"
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

      {/* SETUP GUIDE MODAL IF PROVIDER NOT ENABLED IN SUPABASE */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-white font-bold text-lg">Google Provider Setup Required</h3>
                  <p className="text-white/40 text-xs">Supabase requires one-time activation for Google OAuth</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="text-white/40 hover:text-white p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-sm text-white/70">
              <p>
                Your Supabase project (<code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">hewmnxdmjydfnrtliowb</code>) currently has the Google Auth provider disabled in its settings.
              </p>

              <div className="bg-black/50 border border-white/10 rounded-xl p-4 space-y-3">
                <p className="font-semibold text-white text-xs uppercase tracking-wider">How to enable in 60 seconds:</p>
                <ol className="list-decimal list-inside space-y-2 text-xs text-white/60">
                  <li>
                    Open{" "}
                    <a
                      href="https://supabase.com/dashboard/project/hewmnxdmjydfnrtliowb/auth/providers"
                      target="_blank"
                      rel="noreferrer"
                      className="text-emerald-400 underline hover:text-emerald-300 inline-flex items-center gap-1 font-medium"
                    >
                      Supabase Auth Providers <ExternalLink className="w-3 h-3" />
                    </a>
                  </li>
                  <li>Click on <strong className="text-white">Google</strong> and toggle <strong className="text-white">Enable Sign in with Google</strong> to ON.</li>
                  <li>Paste your <strong className="text-white">Client ID</strong> and <strong className="text-white">Client Secret</strong> from Google Cloud Console.</li>
                  <li>Add this Callback URL to Google Console:
                    <div className="mt-1 font-mono text-[11px] bg-white/5 border border-white/10 px-2.5 py-1.5 rounded text-emerald-400 break-all select-all">
                      https://hewmnxdmjydfnrtliowb.supabase.co/auth/v1/callback
                    </div>
                  </li>
                </ol>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <a
                href="https://supabase.com/dashboard/project/hewmnxdmjydfnrtliowb/auth/providers"
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-medium py-2.5 rounded-xl text-center text-sm transition-colors flex items-center justify-center gap-2"
              >
                Open Supabase Providers <ExternalLink className="w-4 h-4" />
              </a>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="px-5 bg-white/10 hover:bg-white/15 text-white font-medium py-2.5 rounded-xl text-sm transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}