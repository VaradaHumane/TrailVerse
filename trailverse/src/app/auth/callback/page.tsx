"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { syncOAuthUser } from "@/lib/api"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"

export default function AuthCallbackPage() {
  const router = useRouter()
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true

    const handleCallback = async () => {
      try {
        // Retrieve session after OAuth redirect
        const { data: { session }, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) {
          throw sessionError
        }

        if (!session?.user) {
          // Listen for auth state change if session hasn't settled yet
          const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, currentSession) => {
              if (currentSession?.user && active) {
                authListener.subscription.unsubscribe()
                await processUser(currentSession.user)
              }
            }
          )
          return
        }

        if (active) {
          await processUser(session.user)
        }
      } catch (err: unknown) {
        if (!active) return
        const message = err instanceof Error ? err.message : "Failed to authenticate with Google"
        console.error("Auth callback error:", err)
        setError(message)
      }
    }

    const processUser = async (user: {
      id: string
      email?: string
      user_metadata?: { full_name?: string; name?: string; avatar_url?: string; picture?: string }
    }) => {
      if (!user.email) {
        throw new Error("No email provided by Google account")
      }

      const syncResult = await syncOAuthUser({
        email: user.email,
        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null,
        auth_id: user.id,
      })

      if (syncResult?.username) {
        localStorage.setItem("username", syncResult.username)
        window.dispatchEvent(new Event("storage"))
        router.replace("/dashboard")
      } else {
        throw new Error("Unable to create user profile")
      }
    }

    handleCallback()

    return () => {
      active = false
    }
  }, [router])

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <div className="max-w-md w-full text-center space-y-4">
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h2 className="text-white font-semibold text-lg">Authentication Failed</h2>
            <p className="text-white/60 text-sm">{error}</p>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-block bg-white/10 hover:bg-white/20 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
            <h2 className="text-white font-semibold text-xl">Completing Google Sign-in...</h2>
            <p className="text-white/40 text-sm">Setting up your profile and taking you to your dashboard.</p>
          </div>
        )}
      </div>
    </div>
  )
}
