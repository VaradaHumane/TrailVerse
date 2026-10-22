"use client"

import { useState, useEffect } from "react"
import { X, Check } from "lucide-react"
import TrekSearch from "./TrekSearch"

type Props = {
  username: string
  onClose: () => void          // called when user closes the modal
  onSuccess: () => void        // called after successful log — to refresh data
}

export default function LogTrekModal({ username, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState({
    trek_name:     "",
    date:          new Date().toISOString().split("T")[0],  // today's date
    duration_mins: "",
    review:        "",
  })

  const [loading, setLoading]   = useState(false)
  const [success, setSuccess]   = useState(false)
  const [error, setError]       = useState("")
  const [pointsEarned, setPointsEarned] = useState(0)

  const handleTrekSelect = (trek: { name: string }) => {
    setFormData({ ...formData, trek_name: trek.name })
  }

  // Close modal when user presses Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [onClose])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async () => {
    // Basic validation
    if (!formData.trek_name || !formData.date || !formData.duration_mins) {
      setError("Please fill in all required fields")
      return
    }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("http://localhost:8000/treks/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          trek_name:     formData.trek_name,
          date:          formData.date,
          duration_mins: parseInt(formData.duration_mins),
          review:        formData.review,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Something went wrong")
      }

      const data = await res.json()
      setPointsEarned(data.points_earned)
      setSuccess(true)

      // Wait 2 seconds, then close and refresh
      setTimeout(() => {
        onSuccess()
        onClose()
      }, 2000)

    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    // Backdrop — clicking it closes the modal
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center px-4"
      onClick={onClose}
    >
      {/* Modal card — stop click from bubbling to backdrop */}
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-md relative"
        onClick={(e) => e.stopPropagation()}
      >

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-white text-xl font-bold mb-1">Log a Trek</h2>
        <p className="text-white/40 text-sm mb-6">Record a trek to earn Trail Score points</p>

        {/* Success state */}
        {success ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-400" />
            </div>
            <p className="text-white font-semibold text-lg mb-1">Trek logged!</p>
            <p className="text-emerald-400 font-bold text-2xl">+{pointsEarned} points</p>
            <p className="text-white/30 text-sm mt-2">Updating your profile...</p>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Trek name autocomplete */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Trek name *</label>
              <TrekSearch onSelect={handleTrekSelect} />
            </div>

            {/* Date */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Date *</label>
              <input
                name="date"
                type="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Duration */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Duration *</label>
              <input
                name="duration_mins"
                type="number"
                min="1"
                value={formData.duration_mins}
                onChange={handleChange}
                placeholder="eg. 3 hours 30 minutes = 210 minutes"
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Review */}
            <div>
              <label className="block text-white/70 text-sm mb-2">Review <span className="text-white/30">(optional)</span></label>
              <textarea
                name="review"
                value={formData.review}
                onChange={handleChange}
                placeholder="How was the trek?"
                rows={3}
                className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors resize-none"
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {/* Submit button */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
            >
              {loading ? "Logging trek..." : "Log Trek"}
            </button>

          </div>
        )}
      </div>
    </div>
  )
}