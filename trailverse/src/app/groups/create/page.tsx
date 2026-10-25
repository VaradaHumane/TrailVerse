"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mountain, Plus, Trash2 } from "lucide-react"
import { createGroup, ItineraryDay } from "@/lib/api"
import Navbar from "@/components/Navbar"

export default function CreateGroupPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [location, setLocation] = useState("")
  const [cost, setCost] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [maxMembers, setMaxMembers] = useState("")
  const [itinerary, setItinerary] = useState<ItineraryDay[]>([
    { day: 1, title: "", description: "", distance_km: 0 },
  ])
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const addDay = () => {
    setItinerary([
      ...itinerary,
      { day: itinerary.length + 1, title: "", description: "", distance_km: 0 },
    ])
  }

  const removeDay = (index: number) => {
    const updated = itinerary
      .filter((_, i) => i !== index)
      .map((d, i) => ({ ...d, day: i + 1 }))
    setItinerary(updated)
  }

  const updateDay = (index: number, field: keyof ItineraryDay, value: string | number) => {
    const updated = [...itinerary]
    updated[index] = { ...updated[index], [field]: value }
    setItinerary(updated)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    const username = localStorage.getItem("username")
    if (!username) {
      router.push("/login")
      return
    }

    if (!title || !location || !cost) {
      setError("Title, location, and cost are required")
      return
    }

    setSubmitting(true)

    try {
      const result = await createGroup({
        host_username: username,
        title,
        description,
        location,
        cost: parseFloat(cost),
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        max_members: maxMembers ? parseInt(maxMembers) : undefined,
        itinerary: itinerary.filter((d) => d.title.trim() !== ""),
      })
      router.push(`/groups/${result.group.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

      <main className="max-w-3xl mx-auto px-6 pt-24 pb-16">
        <h1 className="text-2xl font-bold text-white mb-1">Host a Trek Group</h1>
        <p className="text-white/40 text-sm mb-8">Fill in the details, and trekkers can find and join your group</p>

        <form onSubmit={handleSubmit} className="space-y-6">

          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Title *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kalsubai Sunrise Trek"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
              />
            </div>

            <div>
              <label className="block text-sm text-white/60 mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell trekkers what to expect..."
                rows={4}
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Location *</label>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Kalsubai, Maharashtra"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Cost (₹) *</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  placeholder="1200"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>
              <div>
                <label className="block text-sm text-white/60 mb-1.5">Max Members</label>
                <input
                  type="number"
                  value={maxMembers}
                  onChange={(e) => setMaxMembers(e.target.value)}
                  placeholder="10"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            </div>
          </div>

          {/* ITINERARY */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white font-semibold">Itinerary</h2>
              <button
                type="button"
                onClick={addDay}
                className="flex items-center gap-1 text-emerald-400 text-sm hover:text-emerald-300"
              >
                <Plus className="w-4 h-4" />
                Add Day
              </button>
            </div>

            {itinerary.map((day, index) => (
              <div key={index} className="bg-black/40 border border-white/10 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-emerald-400 text-sm font-semibold">Day {day.day}</span>
                  {itinerary.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDay(index)}
                      className="text-white/30 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <input
                  value={day.title}
                  onChange={(e) => updateDay(index, "title", e.target.value)}
                  placeholder="e.g. Base village to summit"
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />

                <textarea
                  value={day.description}
                  onChange={(e) => updateDay(index, "description", e.target.value)}
                  placeholder="Describe this day's route..."
                  rows={2}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 resize-none"
                />

                <input
                  type="number"
                  value={day.distance_km || ""}
                  onChange={(e) => updateDay(index, "distance_km", parseFloat(e.target.value) || 0)}
                  placeholder="Distance (km)"
                  className="w-32 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold py-3 rounded-full transition-colors"
          >
            {submitting ? "Creating..." : "Create Group"}
          </button>
        </form>
      </main>
    </div>
  )
}