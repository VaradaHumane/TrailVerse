// Base URL of your FastAPI backend
// In production this would be your deployed API URL
const API_BASE = "http://localhost:8000"

// ── AbortError helper ───────────────────────────────────────
// Callers can check `if (err instanceof AbortError)` to distinguish
// user-initiated cancellations from real failures.
export class AbortError extends Error {
  readonly name = "AbortError"
  constructor(message = "Request was aborted") {
    super(message)
  }
}

// ── Fetch user profile ──
export async function getUserProfile(username: string) {
  const res = await fetch(`${API_BASE}/users/${username}`)
  if (!res.ok) throw new Error("User not found")
  return res.json()
}

// ── Fetch dashboard data ──
export async function getDashboardData(username: string) {
  const res = await fetch(`${API_BASE}/dashboard/${username}`)
  if (!res.ok) throw new Error("Dashboard data not found")
  return res.json()
}

export async function signupUser(data: {
  name: string
  email: string
  username: string
  password: string
  city: string
}) {
  const res = await fetch(`${API_BASE}/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Signup failed")
  }
  return res.json()
}

export async function loginUser(data: {
  email: string
  password: string
}) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Login failed")
  }
  return res.json()
}

// ── Trek Types ──────────────────────────────────────────────
export type Trek = {
  id: string
  name: string
  difficulty: string
  distance_km: number
  location: string
  elevation_m: number | null
  lat: number | null
  lon: number | null
  state: string | null
}

// External search result type (from Wikidata/OSM)
export type ExternalTrekResult = {
  id: string
  name: string
  lat: number | null
  lon: number | null
  elevation_m: number | null
  description: string
  source: "wikidata" | "osm" | "nominatim"
  osm_type?: string
  osm_id?: number
}

// External search response
export type ExternalSearchResponse = {
  results: ExternalTrekResult[]
  count: number
  sources: string[]
}

// ── Fetch all treks ─────────────────────────────────────────
export async function getTreks(
  params?: { q?: string; state?: string; limit?: number; signal?: AbortSignal }
): Promise<Trek[]> {
  const searchParams = new URLSearchParams()
  if (params?.q) searchParams.set("q", params.q)
  if (params?.state) searchParams.set("state", params.state)
  if (params?.limit) searchParams.set("limit", params.limit.toString())
  const queryString = searchParams.toString()
  const url = `${API_BASE}/treks${queryString ? `?${queryString}` : ""}`
  const res = await fetch(url, { signal: params?.signal })
  if (!res.ok) throw new Error("Failed to load treks")
  return res.json()
}

// ── External search (Wikidata + OSM) ─────────────────────────
export async function searchExternal(
  q: string,
  options?: { limit?: number; sources?: string; signal?: AbortSignal }
): Promise<ExternalSearchResponse> {
  const searchParams = new URLSearchParams()
  searchParams.set("q", q)
  if (options?.limit) searchParams.set("limit", options.limit.toString())
  if (options?.sources) searchParams.set("sources", options.sources)
  const url = `${API_BASE}/search/external?${searchParams.toString()}`
  const res = await fetch(url, { signal: options?.signal })
  if (!res.ok) throw new Error("Failed to search external databases")
  return res.json()
}

// ── Trek Groups ──

export type ItineraryDay = {
  day: number
  title: string
  description: string
  distance_km: number
}

export async function createGroup(data: {
  host_username: string
  title: string
  description: string
  location: string
  cost: number
  start_date?: string
  end_date?: string
  max_members?: number
  itinerary: ItineraryDay[]
}) {
  const res = await fetch(`${API_BASE}/groups/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to create group")
  }
  return res.json()
}

export async function listGroups() {
  const res = await fetch(`${API_BASE}/groups`)
  if (!res.ok) throw new Error("Failed to load groups")
  return res.json()
}

export async function getGroup(groupId: string, viewerUsername?: string) {
  const url = viewerUsername
    ? `${API_BASE}/groups/${groupId}?viewer_username=${viewerUsername}`
    : `${API_BASE}/groups/${groupId}`
  const res = await fetch(url)
  if (!res.ok) throw new Error("Group not found")
  return res.json()
}

export async function joinGroup(groupId: string, username: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to join group")
  }
  return res.json()
}

export async function addMember(groupId: string, hostUsername: string, memberUsername: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_username: hostUsername, member_username: memberUsername }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to add member")
  }
  return res.json()
}

export async function getMessages(groupId: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/messages`)
  if (!res.ok) throw new Error("Failed to load announcements")
  return res.json()
}

export async function postMessage(groupId: string, hostUsername: string, message: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ host_username: hostUsername, message }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to post announcement")
  }
  return res.json()
}

export async function getQueries(groupId: string, viewerUsername: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/queries?viewer_username=${viewerUsername}`)
  if (!res.ok) throw new Error("Failed to load queries")
  return res.json()
}

export async function postQuery(groupId: string, username: string, question: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/queries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, question }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to post question")
  }
  return res.json()
}

export async function postReply(groupId: string, queryId: string, username: string, reply: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/queries/${queryId}/reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, reply }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to post reply")
  }
  return res.json()
}

export async function getUserGroups(username: string) {
  const res = await fetch(`${API_BASE}/users/${username}/groups`)
  if (!res.ok) throw new Error("Failed to load your groups")
  return res.json()
}

export async function leaveGroup(groupId: string, username: string) {
  const res = await fetch(`${API_BASE}/groups/${groupId}/leave`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username }),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to leave group")
  }
  return res.json()
}

export async function updateGroup(groupId: string, data: {
  host_username: string
  title: string
  description: string
  location: string
  cost: number
  start_date?: string
  end_date?: string
  max_members?: number
  itinerary: ItineraryDay[]
}) {
  const res = await fetch(`${API_BASE}/groups/${groupId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json()
    throw new Error(err.detail || "Failed to update group")
  }
  return res.json()
}