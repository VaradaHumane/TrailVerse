"use client"


import { useEffect, useState, useCallback, useSyncExternalStore } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  Mountain, MapPin, IndianRupee, Users, Calendar,
  UserPlus, Send, MessageCircle, ChevronDown, ChevronUp, LogOut, Pencil
} from "lucide-react"
import {
  getGroup, joinGroup, addMember, getMessages, postMessage,
  getQueries, postQuery, postReply, leaveGroup,
} from "@/lib/api"

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}

function getSnapshot() {
  return localStorage.getItem("username")
}

function getServerSnapshot() {
  return null
}

type ItineraryDay = {
  day: number
  title: string
  description: string
  distance_km: number
}

type Group = {
  id: string
  title: string
  description: string
  location: string
  cost: number
  start_date: string | null
  end_date: string | null
  max_members: number | null
  itinerary: ItineraryDay[]
  host: { name: string; username: string } | null
}

type Member = { name: string; username: string }

type Message = {
  id: string
  message: string
  created_at: string
  users: { name: string; username: string }
}

type Reply = {
  id: string
  reply: string
  created_at: string
  sender_id: string
  users: { name: string; username: string }
}

type Query = {
  id: string
  question: string
  created_at: string
  user_id: string
  users: { name: string; username: string }
  replies: Reply[]
}

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const groupId = params.id as string

  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [isHost, setIsHost] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState("")
  const [postingMessage, setPostingMessage] = useState(false)

  const [queries, setQueries] = useState<Query[]>([])
  const [newQuestion, setNewQuestion] = useState("")
  const [postingQuestion, setPostingQuestion] = useState(false)
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [expandedQueries, setExpandedQueries] = useState<Record<string, boolean>>({})

  const [addUsername, setAddUsername] = useState("")
  const [addingMember, setAddingMember] = useState(false)
  const [actionError, setActionError] = useState("")
  const [leaving, setLeaving] = useState(false)

  const loadGroup = useCallback(() => {
    getGroup(groupId, username || undefined)
      .then((data) => {
        setGroup(data.group)
        setMembers(data.members)
        setIsHost(data.is_host)
        setIsMember(data.is_member)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [groupId, username])

  const loadMessages = useCallback(() => {
    getMessages(groupId)
      .then((data) => setMessages(data.messages))
      .catch(() => {})
  }, [groupId])

  const loadQueries = useCallback((user: string) => {
    getQueries(groupId, user)
      .then((data) => setQueries(data.queries))
      .catch(() => {})
  }, [groupId])

  useEffect(() => {
    loadGroup()
    loadMessages()
  }, [loadGroup, loadMessages])

  useEffect(() => {
    if (username && (isMember || isHost)) {
      loadQueries(username)
    }
  }, [username, isMember, isHost, loadQueries])

  const handleJoin = async () => {
    if (!username) {
      router.push("/login")
      return
    }
    setActionError("")
    try {
      await joinGroup(groupId, username)
      loadGroup()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to join group")
    }
  }

  const handleLeave = async () => {
    if (!username) return
    if (!confirm("Are you sure you want to leave this group?")) return
    setLeaving(true)
    setActionError("")
    try {
      await leaveGroup(groupId, username)
      loadGroup()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to leave group")
    } finally {
      setLeaving(false)
    }
  }

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !addUsername.trim()) return
    setAddingMember(true)
    setActionError("")
    try {
      await addMember(groupId, username, addUsername.trim())
      setAddUsername("")
      loadGroup()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to add member")
    } finally {
      setAddingMember(false)
    }
  }

  const handlePostMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !newMessage.trim()) return
    setPostingMessage(true)
    try {
      await postMessage(groupId, username, newMessage.trim())
      setNewMessage("")
      loadMessages()
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to post message")
    } finally {
      setPostingMessage(false)
    }
  }

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !newQuestion.trim()) return
    setPostingQuestion(true)
    try {
      await postQuery(groupId, username, newQuestion.trim())
      setNewQuestion("")
      loadQueries(username)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to post question")
    } finally {
      setPostingQuestion(false)
    }
  }

  const handlePostReply = async (queryId: string) => {
    const draft = replyDrafts[queryId]
    if (!username || !draft?.trim()) return
    try {
      await postReply(groupId, queryId, username, draft.trim())
      setReplyDrafts((prev) => ({ ...prev, [queryId]: "" }))
      loadQueries(username)
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : "Failed to post reply")
    }
  }

  const toggleQuery = (queryId: string) => {
    setExpandedQueries({ ...expandedQueries, [queryId]: !expandedQueries[queryId] })
  }

  if (loading) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-emerald-400 text-lg animate-pulse">Loading group...</div>
    </div>
  )

  if (!group) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-red-400">Group not found</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-black text-white">

      {/* NAVBAR */}
      <nav className="w-full border-b border-white/10 bg-black/80 backdrop-blur-md fixed top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-white font-bold text-xl">
            <Mountain className="w-6 h-6 text-emerald-400" />
            TrailVerse
          </Link>
          <Link href="/groups" className="text-sm text-white/60 hover:text-white transition-colors">
            Back to Groups
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pt-24 pb-16 space-y-6">

        {/* HEADER */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">{group.title}</h1>
              <p className="text-white/40 text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {group.location}
              </p>
              {group.host && (
                <p className="text-white/30 text-xs mt-2">
                  Hosted by{" "}
                  <Link href={`/profile/${group.host.username}`} className="text-emerald-400 hover:underline">
                    {group.host.name}
                  </Link>
                </p>
              )}
            </div>

            {!isHost && !isMember && (
              <button
                onClick={handleJoin}
                className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-5 py-2.5 rounded-full transition-colors text-sm shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                Join Group
              </button>
            )}
            {isMember && !isHost && (
              <button
                onClick={handleLeave}
                disabled={leaving}
                className="flex items-center gap-2 text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/20 hover:border-red-500/30 disabled:opacity-50 px-4 py-2 rounded-full transition-colors text-sm shrink-0"
              >
                <LogOut className="w-4 h-4" />
                {leaving ? "Leaving..." : "Leave Group"}
              </button>
            )}
            {isHost && (
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-amber-400 text-sm font-semibold bg-amber-500/10 border border-amber-500/20 px-4 py-2 rounded-full">
                     You&apos;re the host
                    </span>
                    <Link
                        href={`/groups/${groupId}/edit`}
                        className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-full transition-colors"
                    >
                       <Pencil className="w-3.5 h-3.5" />
                           Edit
                    </Link>
                </div>
            )}
            </div>

          {group.description && (
            <p className="text-white/60 text-sm mt-4 leading-relaxed">{group.description}</p>
          )}

          <div className="flex flex-wrap gap-3 mt-5">
            <div className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
              <IndianRupee className="w-4 h-4 text-emerald-400" />
              <span className="text-white text-sm font-semibold">{group.cost.toLocaleString()}</span>
            </div>
            {group.start_date && (
              <div className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-400" />
                <span className="text-white text-sm">
                  {group.start_date}{group.end_date ? ` – ${group.end_date}` : ""}
                </span>
              </div>
            )}
            <div className="bg-black/40 border border-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
              <Users className="w-4 h-4 text-pink-400" />
              <span className="text-white text-sm">
                {members.length}{group.max_members ? ` / ${group.max_members}` : ""} members
              </span>
            </div>
          </div>

          {actionError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-400 text-sm mt-4">
              {actionError}
            </div>
          )}
        </div>

        {/* ITINERARY */}
        {group.itinerary && group.itinerary.length > 0 && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Itinerary</h2>
            <div className="space-y-3">
              {group.itinerary.map((day) => (
                <div key={day.day} className="bg-black/40 border border-white/10 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-emerald-400 text-sm font-bold">Day {day.day}</span>
                    <span className="text-white text-sm font-semibold">{day.title}</span>
                  </div>
                  {day.description && (
                    <p className="text-white/50 text-sm mt-1">{day.description}</p>
                  )}
                  {day.distance_km > 0 && (
                    <p className="text-white/30 text-xs mt-2">{day.distance_km} km</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* HOST: ADD MEMBER */}
        {isHost && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <h2 className="text-white font-semibold mb-4">Add a Member</h2>
            <form onSubmit={handleAddMember} className="flex gap-3">
              <input
                value={addUsername}
                onChange={(e) => setAddUsername(e.target.value)}
                placeholder="Enter username"
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <button
                type="submit"
                disabled={addingMember}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
              >
                {addingMember ? "Adding..." : "Add"}
              </button>
            </form>
          </div>
        )}

        {/* MEMBERS LIST */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Members ({members.length})</h2>
          {members.length === 0 ? (
            <p className="text-white/30 text-sm">No members yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {members.map((m) => (
                <Link
                  key={m.username}
                  href={`/profile/${m.username}`}
                  className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-full pl-1.5 pr-3 py-1.5 hover:border-emerald-500/30 transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-white/60 text-xs font-bold">
                    {m.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-white/70 text-sm">{m.name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ANNOUNCEMENTS */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white font-semibold mb-4">Announcements</h2>

          {isHost && (
            <form onSubmit={handlePostMessage} className="flex gap-3 mb-5">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Post an update for the group..."
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 text-sm"
              />
              <button
                type="submit"
                disabled={postingMessage}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}

          {messages.length === 0 ? (
            <p className="text-white/30 text-sm">No announcements yet</p>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <div key={msg.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                  <p className="text-white/80 text-sm">{msg.message}</p>
                  <p className="text-white/30 text-xs mt-2">
                    {msg.users?.name} · {new Date(msg.created_at).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* QUERIES */}
        {(isMember || isHost) && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-blue-400" />
              <h2 className="text-white font-semibold">
                {isHost ? "Member Queries" : "Ask the Host"}
              </h2>
            </div>

            {!isHost && (
              <form onSubmit={handlePostQuestion} className="flex gap-3 mb-5">
                <input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ask a question about this trek..."
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50 text-sm"
                />
                <button
                  type="submit"
                  disabled={postingQuestion}
                  className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg transition-colors text-sm"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            )}

            {queries.length === 0 ? (
              <p className="text-white/30 text-sm">No questions yet</p>
            ) : (
              <div className="space-y-3">
                {queries.map((q) => (
                  <div key={q.id} className="bg-black/40 border border-white/10 rounded-xl p-4">
                    <button
                      onClick={() => toggleQuery(q.id)}
                      className="w-full flex items-start justify-between gap-3 text-left"
                    >
                      <div>
                        <p className="text-white/80 text-sm">{q.question}</p>
                        <p className="text-white/30 text-xs mt-1">
                          {q.users?.name} · {new Date(q.created_at).toLocaleString()}
                          {q.replies.length > 0 && ` · ${q.replies.length} reply`}
                        </p>
                      </div>
                      {expandedQueries[q.id] ? (
                        <ChevronUp className="w-4 h-4 text-white/30 shrink-0 mt-1" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-white/30 shrink-0 mt-1" />
                      )}
                    </button>

                    {expandedQueries[q.id] && (
                      <div className="mt-4 space-y-3 pl-4 border-l border-white/10">
                        {q.replies.map((r) => (
                          <div key={r.id}>
                            <p className="text-white/60 text-sm">{r.reply}</p>
                            <p className="text-white/25 text-xs mt-0.5">
                              {r.users?.name} · {new Date(r.created_at).toLocaleString()}
                            </p>
                          </div>
                        ))}

                        <div className="flex gap-2 pt-1">
                          <input
                            value={replyDrafts[q.id] || ""}
                            onChange={(e) => setReplyDrafts({ ...replyDrafts, [q.id]: e.target.value })}
                            placeholder="Write a reply..."
                            className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500/50"
                          />
                          <button
                            onClick={() => handlePostReply(q.id)}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                          >
                            Reply
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}