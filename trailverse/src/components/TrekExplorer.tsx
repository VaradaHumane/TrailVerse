"use client"

import { useState, useEffect, useRef, useMemo, useSyncExternalStore } from "react"
import dynamic from "next/dynamic"
import {
  Search,
  MapPin,
  Mountain,
  Thermometer,
  Wind,
  Droplets,
  ArrowUp,
  Loader2,
  AlertTriangle,
  Globe,
  Filter,
  X,
  Shield,
  User,
  Compass,
  CheckCircle2,
  Layers,
  Sparkles,
  ArrowRight,
  ArrowDown,
  Eye,
  Backpack,
  SearchCode,
} from "lucide-react"
import {
  getAllTreksWithRisk,
  searchExternal,
  getTrekWeather,
  type Trek,
  type TrekWithRisk,
  type ExternalTrekResult,
  type LiveWeatherData,
} from "@/lib/api"

// Dynamically import InteractiveTrailMap to ensure pure client-side Leaflet execution
const InteractiveTrailMap = dynamic(() => import("./InteractiveTrailMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] sm:h-[680px] rounded-3xl bg-zinc-950 border border-white/10 flex flex-col items-center justify-center gap-3 animate-pulse shadow-2xl">
      <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
        <Mountain className="w-6 h-6 animate-pulse" />
      </div>
      <p className="text-white/40 text-xs">Loading Interactive Trail Map...</p>
    </div>
  ),
})

// Subscribe to localStorage username
const subscribe = (callback: () => void) => {
  window.addEventListener("storage", callback)
  return () => window.removeEventListener("storage", callback)
}
const getSnapshot = () => localStorage.getItem("username") || ""
const getServerSnapshot = () => ""

// Popular Indian trek tags for 1-click global discovery
const TRENDING_GLOBAL_CHIPS = [
  "Kedarkantha",
  "Triund",
  "Valley of Flowers",
  "Hampta Pass",
  "Kudremukh",
  "Rohtang Pass",
  "Har Ki Dun",
  "Sandhan Valley",
  "Kalsubai",
]

interface TrekExplorerProps {
  initialScope?: "maharashtra" | "global"
  initialQuery?: string
}

export default function TrekExplorer({ initialScope = "maharashtra", initialQuery = "" }: TrekExplorerProps) {
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Scope: "maharashtra" (curated Sahyadris) vs "global" (all of India)
  const [scope, setScope] = useState<"maharashtra" | "global">(initialScope)

  // Treks State (Maharashtra)
  const [allTreks, setAllTreks] = useState<TrekWithRisk[]>([])
  const [loadingTreks, setLoadingTreks] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Global Search State
  const [globalQuery, setGlobalQuery] = useState(initialQuery)
  const [globalResults, setGlobalResults] = useState<TrekWithRisk[]>([])
  const [searchingGlobal, setSearchingGlobal] = useState(false)
  const [globalSearchDone, setGlobalSearchDone] = useState(false)
  const [globalSearchError, setGlobalSearchError] = useState("")

  // Local Filter States
  const [localQuery, setLocalQuery] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("All")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All")
  const [riskFilter, setRiskFilter] = useState<string>("All")
  const [viewMode, setViewMode] = useState<"map" | "grid">("map")

  // Selected Trek
  const [selectedTrek, setSelectedTrek] = useState<TrekWithRisk | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherData, setWeatherData] = useState<LiveWeatherData | null>(null)
  const [weatherError, setWeatherError] = useState("")

  // Autocomplete dropdown (local mode)
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch preloaded Maharashtra curated treks enriched with general and personalized risk
  useEffect(() => {
    let isMounted = true
    setLoadingTreks(true)
    getAllTreksWithRisk(username || undefined)
      .then((res) => {
        if (!isMounted) return
        const loaded = res.treks || []
        setAllTreks(loaded)
        if (loaded.length > 0 && !selectedTrek && scope === "maharashtra") {
          setSelectedTrek(loaded[0])
        }
      })
      .catch((err) => {
        if (!isMounted) return
        setLoadError(err instanceof Error ? err.message : "Failed to load treks")
      })
      .finally(() => {
        if (isMounted) setLoadingTreks(false)
      })

    return () => {
      isMounted = false
    }
  }, [username, scope, selectedTrek])

  // Trigger initial global search if initialQuery exists or if scope is global on mount
  useEffect(() => {
    if (initialScope === "global" && (initialQuery || "Kedarkantha")) {
      handleExecuteGlobalSearch(initialQuery || "Kedarkantha")
    }
  }, [initialScope, initialQuery])

  // Fetch live summit weather when selectedTrek changes
  useEffect(() => {
    if (!selectedTrek || typeof selectedTrek.lat !== "number" || typeof selectedTrek.lon !== "number") {
      setWeatherData(null)
      return
    }

    let isMounted = true
    setWeatherLoading(true)
    setWeatherError("")

    getTrekWeather(selectedTrek.lat, selectedTrek.lon)
      .then((data) => {
        if (isMounted) setWeatherData(data.weather || null)
      })
      .catch((err) => {
        if (isMounted) setWeatherError(err instanceof Error ? err.message : "Live weather telemetry unavailable")
      })
      .finally(() => {
        if (isMounted) setWeatherLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedTrek])

  // Close autocomplete on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Execute Global Search
  const handleExecuteGlobalSearch = async (searchTerm?: string) => {
    const q = (searchTerm ?? globalQuery).trim()
    if (!q) return

    setSearchingGlobal(true)
    setGlobalSearchError("")
    setShowDropdown(false)

    try {
      const res = await searchExternal(q, {
        limit: 30,
        username: username || undefined,
      })

      // Convert external results to TrekWithRisk format with full parity
      const formatted: TrekWithRisk[] = (res.results || []).map((r: ExternalTrekResult, idx: number) => {
        const fallbackId = r.id || `external-${idx}-${encodeURIComponent(r.name)}`
        return {
          id: fallbackId,
          name: r.name,
          difficulty: (r.difficulty as "Easy" | "Medium" | "Moderate" | "Hard") || "Medium",
          distance_km: r.distance_km || 10,
          location: r.location || r.description || "India",
          elevation_m: r.elevation_m || 1500,
          lat: r.lat ?? null,
          lon: r.lon ?? null,
          state: r.state || "India",
          general_risk: r.general_risk || {
            score: 45,
            label: "Moderate Risk",
            color: "amber",
            gradient_m_per_km: 110,
            terrain_hazards: ["High altitude mountain terrain"],
            contributing_factors: [{ label: "Alpine elevation exposure", severity: "medium" }],
            recommended_gear: ["Sturdy hiking boots", "1.5L Hydration pack", "Warm fleece layer"],
            emergency_notes: "Keep emergency contacts and trail map offline.",
          },
          personalized_risk: r.personalized_risk ?? null,
        }
      })

      setGlobalResults(formatted)
      setGlobalSearchDone(true)

      if (formatted.length > 0) {
        setSelectedTrek(formatted[0])
      }
    } catch (err) {
      setGlobalSearchError(err instanceof Error ? err.message : "Failed to execute global search")
    } finally {
      setSearchingGlobal(false)
    }
  }

  // Active dataset depending on selected scope
  const activeTreks = scope === "maharashtra" ? allTreks : globalResults

  // Extract unique states for filter pill
  const availableStates = useMemo(() => {
    const set = new Set<string>()
    activeTreks.forEach((t) => {
      if (t.state) set.add(t.state)
    })
    return ["All", ...Array.from(set)]
  }, [activeTreks])

  // Filtered Treks
  const filteredTreks = useMemo(() => {
    return activeTreks.filter((trek) => {
      // Local query filter
      if (scope === "maharashtra" && localQuery.trim()) {
        const q = localQuery.toLowerCase().trim()
        const matchName = trek.name.toLowerCase().includes(q)
        const matchLoc = trek.location.toLowerCase().includes(q)
        if (!matchName && !matchLoc) return false
      }

      // State filter
      if (stateFilter !== "All" && trek.state !== stateFilter) return false

      // Difficulty filter
      if (difficultyFilter !== "All" && trek.difficulty !== difficultyFilter) return false

      // Risk filter
      if (riskFilter !== "All") {
        const score = trek.general_risk?.score ?? 0
        if (riskFilter === "Low Risk" && score >= 35) return false
        if (riskFilter === "Moderate Risk" && (score < 35 || score >= 65)) return false
        if (riskFilter === "High Risk" && score < 65) return false
      }

      return true
    })
  }, [activeTreks, scope, localQuery, stateFilter, difficultyFilter, riskFilter])

  const handleTrekSelect = (trek: TrekWithRisk, shouldScroll = false) => {
    setSelectedTrek(trek)
    setShowDropdown(false)
    if (shouldScroll) {
      setTimeout(() => {
        const el = document.getElementById("trek-telemetry-panel")
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" })
          el.classList.add("ring-2", "ring-emerald-400")
          setTimeout(() => el.classList.remove("ring-2", "ring-emerald-400"), 2500)
        }
      }, 80)
    }
  }

  const handleSwitchScope = (newScope: "maharashtra" | "global") => {
    setScope(newScope)
    setStateFilter("All")
    setDifficultyFilter("All")
    setRiskFilter("All")

    if (newScope === "maharashtra" && allTreks.length > 0) {
      setSelectedTrek(allTreks[0])
    } else if (newScope === "global") {
      if (globalResults.length > 0) {
        setSelectedTrek(globalResults[0])
      } else if (!globalSearchDone) {
        // Run starter search for Kedarkantha to populate initial map
        handleExecuteGlobalSearch("Kedarkantha")
      }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>Interactive Trail Atlas & Telemetry Engine</span>
          </div>
          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Trails & Hazards</span>
          </h1>
          <p className="text-white/60 text-sm sm:text-base mt-2 max-w-2xl leading-relaxed">
            Pan across India&apos;s mountain ranges, view real-time topography, evaluate objective trail risks, and inspect personalized readiness matched to your trekking profile.
          </p>
        </div>

        {/* VIEW MODE TOGGLE */}
        <div className="flex items-center gap-2 bg-zinc-900 border border-white/15 p-1 rounded-2xl shrink-0 self-start md:self-auto shadow-xl">
          <button
            onClick={() => setViewMode("map")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              viewMode === "map"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>🗺️</span>
            <span>Interactive Map</span>
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              viewMode === "grid"
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/20"
                : "text-white/60 hover:text-white"
            }`}
          >
            <span>🗂️</span>
            <span>Trail Cards ({filteredTreks.length})</span>
          </button>
        </div>
      </div>

      {/* SCOPE SELECTION TABS: MAHARASHTRA vs ALL-INDIA GLOBAL */}
      <div className="bg-zinc-900/90 border border-white/10 p-2 rounded-2xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSwitchScope("maharashtra")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              scope === "maharashtra"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🏔️</span>
            <span>Maharashtra Sahyadris ({allTreks.length || 58} Preloaded Summits)</span>
          </button>

          <button
            onClick={() => handleSwitchScope("global")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all ${
              scope === "global"
                ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25"
                : "text-white/60 hover:text-white hover:bg-white/5"
            }`}
          >
            <span>🌐</span>
            <span>All-India Global Search</span>
            <span className="hidden md:inline-block text-[10px] bg-emerald-400/20 text-emerald-300 px-2 py-0.5 rounded-full font-semibold border border-emerald-400/30">
              Himalayas & Beyond
            </span>
          </button>
        </div>

        <div className="text-[11px] text-white/40 px-3 py-1 flex items-center gap-1.5 self-center sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span>100% Free Live Telemetry & Zero API Limits</span>
        </div>
      </div>

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        {scope === "maharashtra" ? (
          /* MAHARASHTRA LOCAL AUTOCOMPLETE SEARCH */
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1" ref={dropdownRef}>
              <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                ref={inputRef}
                type="text"
                value={localQuery}
                onChange={(e) => {
                  setLocalQuery(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Filter within 58 Maharashtra summits (e.g. Kalsubai, Kalavantin, Raigad, Harishchandragad)..."
                className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
              />
              {localQuery && (
                <button
                  onClick={() => setLocalQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* QUICK AUTOCOMPLETE DROPDOWN */}
              {showDropdown && localQuery.trim() && filteredTreks.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-zinc-900 border border-white/20 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                  {filteredTreks.slice(0, 6).map((t) => (
                    <div
                      key={t.id}
                      onClick={() => handleTrekSelect(t)}
                      className="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                    >
                      <div>
                        <div className="text-white font-medium text-xs">{t.name}</div>
                        <div className="text-white/40 text-[11px]">
                          {t.location} · {t.elevation_m}m
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-emerald-400">
                        {t.difficulty}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* DIFFICULTY FILTER */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs shrink-0">Difficulty:</span>
              <select
                value={difficultyFilter}
                onChange={(e) => setDifficultyFilter(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="All" className="bg-zinc-900">All Levels</option>
                <option value="Easy" className="bg-zinc-900">Easy</option>
                <option value="Medium" className="bg-zinc-900">Medium</option>
                <option value="Hard" className="bg-zinc-900">Hard</option>
              </select>
            </div>

            {/* RISK FILTER */}
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-xs shrink-0">Risk:</span>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value)}
                className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
              >
                <option value="All" className="bg-zinc-900">All Risks</option>
                <option value="Low Risk" className="bg-zinc-900">Low Risk (&lt;35)</option>
                <option value="Moderate Risk" className="bg-zinc-900">Moderate (35-64)</option>
                <option value="High Risk" className="bg-zinc-900">High Risk (65+)</option>
              </select>
            </div>
          </div>
        ) : (
          /* GLOBAL ALL-INDIA SEARCH WITH EXPLICIT SEARCH BUTTON */
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleExecuteGlobalSearch()
                    }
                  }}
                  placeholder="Search any trek, peak, pass or fort across India (e.g. Kedarkantha, Triund, Hampta Pass)..."
                  className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
                />
                {globalQuery && (
                  <button
                    onClick={() => setGlobalQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* EXPLICIT SEARCH BUTTON */}
              <button
                onClick={() => handleExecuteGlobalSearch()}
                disabled={searchingGlobal || !globalQuery.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 transition-all"
              >
                {searchingGlobal ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Searching India...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span>Search Trails</span>
                  </>
                )}
              </button>

              {/* DIFFICULTY FILTER */}
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs shrink-0">Difficulty:</span>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="All" className="bg-zinc-900">All Levels</option>
                  <option value="Easy" className="bg-zinc-900">Easy</option>
                  <option value="Medium" className="bg-zinc-900">Medium</option>
                  <option value="Hard" className="bg-zinc-900">Hard</option>
                </select>
              </div>

              {/* RISK FILTER */}
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-xs shrink-0">Risk:</span>
                <select
                  value={riskFilter}
                  onChange={(e) => setRiskFilter(e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="All" className="bg-zinc-900">All Risks</option>
                  <option value="Low Risk" className="bg-zinc-900">Low Risk (&lt;35)</option>
                  <option value="Moderate Risk" className="bg-zinc-900">Moderate (35-64)</option>
                  <option value="High Risk" className="bg-zinc-900">High Risk (65+)</option>
                </select>
              </div>
            </div>

            {/* QUICK INSPIRATION TAGS */}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-white/5">
              <span className="text-white/40 text-xs flex items-center gap-1 font-medium">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Trending:
              </span>
              {TRENDING_GLOBAL_CHIPS.map((chip) => (
                <button
                  key={chip}
                  onClick={() => {
                    setGlobalQuery(chip)
                    handleExecuteGlobalSearch(chip)
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/15 border border-white/10 hover:border-emerald-500/30 text-white/70 hover:text-emerald-300 transition-all font-medium"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STATUS AND RESULTS BANNER */}
      {scope === "global" && (
        <div className="flex items-center justify-between text-xs text-white/50 px-2">
          {searchingGlobal ? (
            <div className="flex items-center gap-2 text-emerald-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Querying Wikidata, OpenStreetMap, and national database...</span>
            </div>
          ) : globalSearchDone ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>
                Found {filteredTreks.length} summits for &quot;{globalQuery}&quot; across India with full AI hazard ratings
              </span>
            </div>
          ) : (
            <span>Type a mountain or pass name above and click &quot;Search Trails&quot;</span>
          )}

          {globalSearchError && (
            <span className="text-red-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {globalSearchError}
            </span>
          )}
        </div>
      )}

      {/* MAIN VIEW CONTENT */}
      {loadingTreks && scope === "maharashtra" ? (
        <div className="h-96 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 animate-pulse">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-white/40 text-sm">Loading 58 Sahyadri summits & hazard telemetry...</p>
        </div>
      ) : searchingGlobal ? (
        <div className="h-96 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 animate-pulse">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-white/40 text-sm">Searching All-India trails & calculating hazard telemetry...</p>
        </div>
      ) : loadError && scope === "maharashtra" ? (
        <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {loadError}
        </div>
      ) : filteredTreks.length === 0 ? (
        <div className="h-72 rounded-3xl bg-zinc-950 border border-white/10 flex flex-col items-center justify-center gap-3 text-center p-6 shadow-2xl">
          <Mountain className="w-10 h-10 text-white/30" />
          <p className="text-white/80 font-bold text-base">No trails found matching this criteria</p>
          <p className="text-white/40 text-xs max-w-sm">
            {scope === "maharashtra"
              ? "Try clearing filters or search across all of India using the All-India Global Search tab."
              : "Try searching with an alternate spelling or click on any of the trending chips above."}
          </p>
        </div>
      ) : viewMode === "map" ? (
        /* INTERACTIVE MAP MODE */
        <div className="space-y-6">
          <InteractiveTrailMap
            treks={filteredTreks}
            selectedTrekId={selectedTrek?.id}
            onSelectTrek={(trek) => handleTrekSelect(trek, false)}
          />

          {/* TELEMETRY & 2-TIER RISK DASHBOARD (FOR SELECTED TREK) */}
          {selectedTrek && (
            <div
              id="trek-telemetry-panel"
              className="scroll-mt-24 transition-all duration-300 bg-zinc-900/90 border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl"
            >
              {/* TOP HEADER */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-md uppercase tracking-wider ${
                        selectedTrek.difficulty === "Easy"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : selectedTrek.difficulty === "Hard"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {selectedTrek.difficulty}
                    </span>
                    <span className="text-white/50 text-xs font-semibold">
                      {selectedTrek.state || "Maharashtra"}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">{selectedTrek.name}</h2>
                  <p className="text-white/50 text-xs sm:text-sm flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{selectedTrek.location}</span>
                  </p>
                </div>

                {/* KEY STATS PILLS */}
                <div className="flex items-center gap-3">
                  <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-bold">
                      Elevation
                    </span>
                    <span className="text-lg font-black text-white">{selectedTrek.elevation_m}m</span>
                  </div>

                  <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-bold">
                      Distance
                    </span>
                    <span className="text-lg font-black text-white">{selectedTrek.distance_km}km</span>
                  </div>

                  <div className="bg-black/40 border border-white/10 px-4 py-2.5 rounded-xl text-center">
                    <span className="text-[10px] text-white/40 uppercase tracking-wider block font-bold">
                      Gradient
                    </span>
                    <span className="text-lg font-black text-emerald-400">
                      {selectedTrek.distance_km > 0 && selectedTrek.elevation_m != null
                        ? Math.round(selectedTrek.elevation_m / selectedTrek.distance_km)
                        : 0}
                      m/km
                    </span>
                  </div>
                </div>
              </div>

              {/* 2-TIER RISK PREDICTOR GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. GENERAL OBJECTIVE RISK */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-white text-sm">1. General Trail Risk</h3>
                    </div>
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full border ${
                        selectedTrek.general_risk?.color === "red"
                          ? "bg-red-500/20 text-red-400 border-red-500/30"
                          : selectedTrek.general_risk?.color === "amber"
                          ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                      }`}
                    >
                      {selectedTrek.general_risk?.label} ({selectedTrek.general_risk?.score}/100)
                    </span>
                  </div>

                  <p className="text-xs text-white/50">
                    Objective environmental hazards calculated from elevation, rock gradient, trail distance, and mountain terrain exposure.
                  </p>

                  {/* CONTRIBUTING FACTORS */}
                  {selectedTrek.general_risk?.contributing_factors && (
                    <div className="space-y-1.5">
                      <span className="text-[11px] font-bold text-white/70 uppercase tracking-wider">
                        Contributing Factors:
                      </span>
                      <ul className="space-y-1 text-xs text-white/80">
                        {selectedTrek.general_risk.contributing_factors.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                                f.severity === "high"
                                  ? "bg-red-400"
                                  : f.severity === "medium"
                                  ? "bg-amber-400"
                                  : "bg-emerald-400"
                              }`}
                            ></span>
                            <span>{f.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* GEAR ADVISORY */}
                  {selectedTrek.general_risk?.recommended_gear && (
                    <div className="pt-2 border-t border-white/5 space-y-1.5">
                      <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                        <Backpack className="w-3.5 h-3.5" /> Recommended Gear:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTrek.general_risk.recommended_gear.map((g, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-white/80"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. PERSONALIZED PROFILE RISK */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-emerald-400" />
                      <h3 className="font-bold text-white text-sm">2. Personalized Profile Risk</h3>
                    </div>
                    {selectedTrek.personalized_risk && (
                      <span
                        className={`text-xs font-bold px-3 py-1 rounded-full border ${
                          selectedTrek.personalized_risk.color === "red"
                            ? "bg-red-500/20 text-red-400 border-red-500/30"
                            : selectedTrek.personalized_risk.color === "amber"
                            ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
                            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {selectedTrek.personalized_risk.readiness_percentage}% Ready
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-white/50">
                    Difficulty matched against your profile trail score, logged summits, and past elevation conquered.
                  </p>

                  {selectedTrek.personalized_risk ? (
                    <div className="space-y-3">
                      <div className="bg-white/5 border border-white/5 p-3 rounded-xl space-y-1">
                        <span className="text-[11px] font-bold text-white flex items-center justify-between">
                          <span>Profile Verdict:</span>
                          <span className="text-emerald-300 font-extrabold">
                            {selectedTrek.personalized_risk.verdict}
                          </span>
                        </span>
                        <p className="text-xs text-white/70 leading-relaxed">
                          {selectedTrek.personalized_risk.personalized_advice}
                        </p>
                      </div>

                      {/* LEAP STATS */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <span className="text-[10px] text-white/40 block">Elevation Leap</span>
                          <span className="font-bold text-white">
                            +{selectedTrek.personalized_risk.experience_gap.elevation_delta_m}m
                          </span>
                        </div>
                        <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                          <span className="text-[10px] text-white/40 block">Distance Leap</span>
                          <span className="font-bold text-white">
                            +{selectedTrek.personalized_risk.experience_gap.distance_delta_km}km
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-white/5 border border-white/5 text-xs text-white/60 space-y-2">
                      <p>Log in with your TrailVerse account to calculate your personalized fitness readiness for this summit.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE MOUNTAIN WEATHER AT SUMMIT */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-emerald-400" />
                    Live Mountain Weather at Summit (100% Free Open-Meteo)
                  </h4>
                  {weatherLoading && (
                    <span className="text-[11px] text-white/40 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Fetching live telemetry...
                    </span>
                  )}
                </div>

                {weatherData ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-white/40 text-[10px] block">Temperature</span>
                      <span className="text-base font-bold text-white">
                        {Math.round(weatherData.temp)}°C
                      </span>
                      <span className="text-white/40 text-[10px] block">
                        Feels like {Math.round(weatherData.feels_like)}°C
                      </span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-white/40 text-[10px] block">Wind Speed</span>
                      <span className="text-base font-bold text-white flex items-center gap-1">
                        <Wind className="w-3.5 h-3.5 text-blue-400" />
                        {weatherData.wind_speed} m/s
                      </span>
                      <span className="text-white/40 text-[10px] block">Ridge exposure</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-white/40 text-[10px] block">Humidity</span>
                      <span className="text-base font-bold text-white flex items-center gap-1">
                        <Droplets className="w-3.5 h-3.5 text-teal-400" />
                        {weatherData.humidity}%
                      </span>
                      <span className="text-white/40 text-[10px] block">Moisture index</span>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl">
                      <span className="text-white/40 text-[10px] block">Sky Conditions</span>
                      <span className="text-sm font-bold text-white capitalize">
                        {weatherData.weather_desc || "Clear skies"}
                      </span>
                      <span className="text-white/40 text-[10px] block">Good visibility</span>
                    </div>
                  </div>
                ) : weatherError ? (
                  <div className="text-amber-400 text-xs py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 flex items-center gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{weatherError}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* GRID CARDS VIEW MODE */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in">
          {filteredTreks.map((trek) => {
            const isSelected = trek.id === selectedTrek?.id
            return (
              <div
                key={trek.id}
                className={`bg-zinc-900 border rounded-2xl p-5 flex flex-col justify-between transition-all hover:border-emerald-500/40 hover:-translate-y-1 ${
                  isSelected ? "border-emerald-500 shadow-xl shadow-emerald-500/10" : "border-white/10"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                        trek.difficulty === "Easy"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : trek.difficulty === "Hard"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {trek.difficulty}
                    </span>
                    <span className="text-white/40 text-xs">{trek.state || "Maharashtra"}</span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white">{trek.name}</h3>
                    <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-emerald-400" />
                      {trek.location}
                    </p>
                  </div>

                  {/* STATS */}
                  <div className="grid grid-cols-3 gap-2 bg-black/40 border border-white/5 rounded-xl p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-white/40 block">Elevation</span>
                      <span className="font-semibold text-white">{trek.elevation_m}m</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/40 block">Distance</span>
                      <span className="font-semibold text-white">{trek.distance_km}km</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-white/40 block">Risk</span>
                      <span
                        className={`font-semibold ${
                          trek.general_risk?.color === "red"
                            ? "text-red-400"
                            : trek.general_risk?.color === "amber"
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {trek.general_risk?.score ?? 25}/100
                      </span>
                    </div>
                  </div>

                  {/* USER PERSONALIZED READINESS TAG */}
                  {trek.personalized_risk && (
                    <div className="bg-emerald-500/5 border border-emerald-500/15 rounded-xl p-2.5 text-[11px] text-white/70 flex items-center justify-between">
                      <span className="text-emerald-300 flex items-center gap-1">
                        <User className="w-3 h-3 text-emerald-400" />
                        {trek.personalized_risk.verdict}
                      </span>
                      <span className="font-bold text-white">
                        {trek.personalized_risk.readiness_percentage}% Ready
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                  <button
                    onClick={() => {
                      handleTrekSelect(trek)
                      setViewMode("map")
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1"
                  >
                    <span>View on Map</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleTrekSelect(trek, true)}
                    className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
