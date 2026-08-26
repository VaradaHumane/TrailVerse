"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Mountain, Plus, Users, MapPin, IndianRupee } from "lucide-react"
import { listGroups } from "@/lib/api"

type Group = {
  id: string
  title: string
  description: string
  location: string
  cost: number
  start_date: string | null
  max_members: number | null
  member_count: number
  host: { name: string; username: string } | null
}

export default function GroupsPage() {
  const router = useRouter()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    listGroups()
      .then((data) => {
        setGroups(data.groups)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-emerald-400 text-lg animate-pulse">Loading groups...</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">

      {/* NAVBAR */}
      <nav className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md fixed top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
            <Mountain className="w-6 h-6 text-emerald-400" />
            TrailVerse
          </Link>
          <Link
            href="/dashboard"
            className="text-sm text-white/60 hover:text-white transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 pt-24 pb-16">

        {/* TOP BAR */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Trek Groups</h1>
            <p className="text-white/40 text-sm mt-1">Join a group or host your own trek</p>
          </div>

          <button
            onClick={() => router.push("/groups/create")}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            Host a Group
          </button>
        </div>

        {/* GROUPS GRID */}
        {groups.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-white/30">No trek groups yet. Be the first to host one!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <Link
                key={group.id}
                href={`/groups/${group.id}`}
                className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-emerald-500/30 transition-colors block"
              >
                <h3 className="text-white font-bold text-lg mb-1">{group.title}</h3>
                <p className="text-white/40 text-sm mb-4 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {group.location}
                </p>

                <p className="text-white/50 text-sm mb-4 line-clamp-2">{group.description}</p>

                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <IndianRupee className="w-3.5 h-3.5" />
                    {group.cost.toLocaleString()}
                  </span>
                  <span className="flex items-center gap-1 text-white/40">
                    <Users className="w-3.5 h-3.5" />
                    {group.member_count}{group.max_members ? ` / ${group.max_members}` : ""}
                  </span>
                </div>

                {group.host && (
                  <p className="text-white/30 text-xs mt-4">
                    Hosted by {group.host.name}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}