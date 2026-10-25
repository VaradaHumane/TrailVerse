"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus, Users, MapPin, IndianRupee } from "lucide-react"
import { listGroups } from "@/lib/api"
import Navbar from "@/components/Navbar"

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
        setGroups(data.groups || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-black text-white">
      <Navbar />

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
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-6 h-52 space-y-3">
                <div className="h-6 bg-white/10 rounded-md w-3/4" />
                <div className="h-4 bg-white/5 rounded-md w-1/2" />
                <div className="h-12 bg-white/5 rounded-md w-full" />
                <div className="h-4 bg-white/10 rounded-md w-1/3 pt-2" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-white/40 mb-2">No trek groups active yet.</p>
            <p className="text-white/30 text-sm">Host an upcoming trek and invite fellow trekkers to join!</p>
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