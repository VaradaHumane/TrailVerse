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
  Eye,
  Backpack,
} from "lucide-react"
import { getAllTreksWithRisk, searchExternal } from "@/lib/api"
import type { Trek, TrekWithRisk, ExternalTrekResult } from "@/lib/api"

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

export default function TrekExplorer() {
  const username = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  // Treks State
  const [allTreks, setAllTreks] = useState<TrekWithRisk[]>([])
  const [loadingTreks, setLoadingTreks] = useState(true)
  const [loadError, setLoadError] = useState("")

  // Filter States
  const [query, setQuery] = useState("")
  const [stateFilter, setStateFilter] = useState<string>("All")
  const [difficultyFilter, setDifficultyFilter] = useState<string>("All")
  const [riskFilter, setRiskFilter] = useState<string>("All")
  const [viewMode, setViewMode] = useState<"map" | "grid">("map")

  // Selected Trek
  const [selectedTrek, setSelectedTrek] = useState<TrekWithRisk | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherData, setWeatherData] = useState<any>(null)
  const [weatherError, setWeatherError] = useState("")

  // Search dropdown
  const [showDropdown, setShowDropdown] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fetch all curated treks enriched with general and personalized risk
  useEffect(() => {
    let isMounted = true
    setLoadingTreks(true)
    getAllTreksWithRisk(username || undefined)
      .then((res) => {
        if (!isMounted) return
        setAllTreks(res.treks || [])
        if (res.treks && res.treks.length > 0 && !selectedTrek) {
          // Default select the first popular trek (e.g. Rajmachi or Harihar)
          setSelectedTrek(res.treks[0])
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
  }, [username])

  // Fetch live weather when selectedTrek changes
  useEffect(() => {
    if (!selectedTrek || !selectedTrek.lat || !selectedTrek.lon) {
      setWeatherData(null)
      return
    }

    let isMounted = true
    setWeatherLoading(true)
    setWeatherError("")

    fetch(`http://localhost:8000/weather/${selectedTrek.lat}/${selectedTrek.lon}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.detail || "Live weather unavailable")
        }
        return res.json()
      })
      .then((data) => {
        if (isMounted) setWeatherData(data.weather || null)
      })
      .catch((err) => {
        if (isMounted) setWeatherError(err instanceof Error ? err.message : "Weather unavailable")
      })
      .finally(() => {
        if (isMounted) setWeatherLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [selectedTrek])

  // Extract unique states for filter pill
  const availableStates = useMemo(() => {
    const set = new Set<string>()
    allTreks.forEach((t) => {
      if (t.state) set.add(t.state)
    })
    return ["All", ...Array.from(set)]
  }, [allTreks])

  // Filtered Treks
  const filteredTreks = useMemo(() => {
    return allTreks.filter((trek) => {
      // Query filter
      if (query.trim()) {
        const q = query.toLowerCase().trim()
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
  }, [allTreks, query, stateFilter, difficultyFilter, riskFilter])

  const handleTrekSelect = (trek: TrekWithRisk) => {
    setSelectedTrek(trek)
    setShowDropdown(false)
  }

  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-4 sm:px-6 max-w-7xl mx-auto space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/10 pb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
            <Compass className="w-3.5 h-3.5" />
            <span>Interactive Trail Atlas & Telemetry</span>
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

      {/* SEARCH & FILTERS TOOLBAR */}
      <div className="bg-zinc-900/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* SEARCH INPUT */}
          <div className="relative flex-1" ref={dropdownRef}>
            <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShowDropdown(true)
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search by trek name or region (e.g. Kalsubai, Lonavala, Nashik)..."
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-emerald-500 transition-colors"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* QUICK AUTOCOMPLETE DROPDOWN */}
            {showDropdown && query.trim() && filteredTreks.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 z-30 bg-zinc-900 border border-white/20 rounded-xl overflow-hidden shadow-2xl max-h-60 overflow-y-auto">
                {filteredTreks.slice(0, 6).map((t) => (
                  <div
                    key={t.id}
                    onClick={() => handleTrekSelect(t)}
                    className="p-3 hover:bg-white/5 cursor-pointer flex items-center justify-between border-b border-white/5 last:border-0 transition-colors"
                  >
                    <div>
                      <div className="text-white font-medium text-xs">{t.name}</div>
                      <div className="text-white/40 text-[11px]">{t.location} · {t.elevation_m}m</div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/10 text-emerald-400">
                      {t.difficulty}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* STATE FILTER */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none py-1">
            <span className="text-white/40 text-xs shrink-0 flex items-center gap-1">
              <Filter className="w-3 h-3" /> State:
            </span>
            <select
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
            >
              {availableStates.map((st) => (
                <option key={st} value={st} className="bg-zinc-900">
                  {st}
                </option>
              ))}
            </select>
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
      </div>

      {/* MAIN VIEW CONTENT */}
      {loadingTreks ? (
        <div className="h-96 rounded-3xl bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 animate-pulse">
          <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
          <p className="text-white/40 text-sm">Loading curated summits & hazard telemetry...</p>
        </div>
      ) : loadError ? (
        <div className="p-8 text-center bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          {loadError}
        </div>
      ) : viewMode === "map" ? (
        /* INTERACTIVE MAP MODE */
        <div className="space-y-6">
          <InteractiveTrailMap
            treks={filteredTreks}
            selectedTrekId={selectedTrek?.id}
            onSelectTrek={handleTrekSelect}
            currentUser={username}
          />

          {/* BELOW MAP: SELECTED TREK FULL TELEMETRY & 2 RISK PREDICTORS */}
          {selectedTrek && (
            <div className="bg-zinc-900 border border-white/15 rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-in fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        selectedTrek.difficulty === "Easy"
                          ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                          : selectedTrek.difficulty === "Hard"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {selectedTrek.difficulty}
                    </span>
                    <span className="text-white/50 text-xs">
                      {selectedTrek.state || "Maharashtra"}
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    {selectedTrek.name}
                  </h2>
                  <p className="text-white/50 text-xs sm:text-sm flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    {selectedTrek.location}
                  </p>
                </div>

                {/* STAT TILES */}
                <div className="flex items-center gap-3">
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-3 text-center min-w-[80px]">
                    <span className="text-[10px] text-white/40 block">Elevation</span>
                    <span className="text-base font-bold text-white">
                      {selectedTrek.elevation_m ? `${selectedTrek.elevation_m}m` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-3 text-center min-w-[80px]">
                    <span className="text-[10px] text-white/40 block">Distance</span>
                    <span className="text-base font-bold text-white">
                      {selectedTrek.distance_km ? `${selectedTrek.distance_km}km` : "N/A"}
                    </span>
                  </div>
                  <div className="bg-black/60 border border-white/10 rounded-2xl p-3 text-center min-w-[80px]">
                    <span className="text-[10px] text-white/40 block">Steepness</span>
                    <span className="text-base font-bold text-emerald-400">
                      {selectedTrek.general_risk?.gradient_m_per_km
                        ? `${selectedTrek.general_risk.gradient_m_per_km}m/km`
                        : "Normal"}
                    </span>
                  </div>
                </div>
              </div>

              {/* TWO SETS OF AI RISK PREDICTORS IN DUAL COLUMNS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. GENERAL RISK PREDICTOR (OBJECTIVE) */}
                <div className="bg-black/40 border border-white/10 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                        <Shield className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">1. General Trail Risk</h4>
                        <span className="text-[10px] text-white/40">Objective Environmental Hazards</span>
                      </div>
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
                      {selectedTrek.general_risk?.label || "Low Risk"} · {selectedTrek.general_risk?.score ?? 20}/100
                    </span>
                  </div>

                  {/* HAZARD FACTORS */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-white/60 uppercase tracking-wider block">
                      Contributing Factors:
                    </span>
                    {(selectedTrek.general_risk?.contributing_factors || []).map((factor, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-xs text-white/70">
                        <span
                          className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${
                            factor.severity === "high"
                              ? "bg-red-400"
                              : factor.severity === "medium"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                          }`}
                        />
                        <span>{factor.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* RECOMMENDED GEAR */}
                  <div className="space-y-1.5 pt-2 border-t border-white/5">
                    <span className="text-[11px] font-semibold text-white/60 flex items-center gap-1">
                      <Backpack className="w-3 h-3 text-emerald-400" /> Essential Gear Required:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {(selectedTrek.general_risk?.recommended_gear || ["Sturdy trail boots", "2L Hydration"]).map(
                        (gear, i) => (
                          <span
                            key={i}
                            className="text-[11px] bg-white/5 border border-white/10 px-2.5 py-1 rounded-lg text-white/80"
                          >
                            {gear}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. PERSONALIZED RISK PREDICTOR (USER-CENTRIC) */}
                <div className="bg-black/40 border border-emerald-500/20 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                        <User className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">2. Personalized Profile Risk</h4>
                        <span className="text-[10px] text-white/40">
                          {username ? `@${username}'s Fitness Analysis` : "Default Profile Evaluation"}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        selectedTrek.personalized_risk?.color === "red"
                          ? "bg-red-500/20 text-red-400"
                          : selectedTrek.personalized_risk?.color === "amber"
                          ? "bg-amber-500/20 text-amber-400"
                          : "bg-emerald-500/20 text-emerald-300"
                      }`}
                    >
                      {selectedTrek.personalized_risk?.readiness_percentage ?? 85}% Ready
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-white/60">Profile Verdict:</span>
                      <span className="font-bold text-white">
                        {selectedTrek.personalized_risk?.verdict || "Optimal Match"}
                      </span>
                    </div>

                    {/* Readiness Progress Bar */}
                    <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{
                          width: `${selectedTrek.personalized_risk?.readiness_percentage ?? 85}%`,
                        }}
                      />
                    </div>

                    <p className="text-xs text-white/70 leading-relaxed bg-white/5 border border-white/5 p-3 rounded-xl">
                      {selectedTrek.personalized_risk?.personalized_advice ||
                        "This trail fits your demonstrated experience level. Keep steady pacing on initial ascents."}
                    </p>
                  </div>

                  {/* EXPERIENCE DELTA STATS */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                    <div className="bg-white/5 p-2 rounded-xl text-center">
                      <span className="text-white/40 text-[10px] block">Elevation Leap</span>
                      <span className="font-semibold text-white">
                        +{selectedTrek.personalized_risk?.experience_gap?.elevation_delta_m ?? 0}m
                      </span>
                    </div>
                    <div className="bg-white/5 p-2 rounded-xl text-center">
                      <span className="text-white/40 text-[10px] block">Distance Leap</span>
                      <span className="font-semibold text-white">
                        +{selectedTrek.personalized_risk?.experience_gap?.distance_delta_km ?? 0}km
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* LIVE WEATHER PANEL */}
              <div className="bg-black/50 border border-white/10 rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-emerald-400" />
                    Live Mountain Weather at Summit
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
                  <div className="text-white/40 text-xs py-2">
                    Live meteorological sensor telemetry offline. Standard microclimate predictions applied.
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
                    onClick={() => handleTrekSelect(trek)}
                    className="text-xs text-white/60 hover:text-white px-3 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    Select
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
