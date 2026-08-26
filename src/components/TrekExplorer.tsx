"use client"

import { useState, useEffect, useRef } from "react"
import { Search, MapPin, Mountain, Thermometer, Wind, Droplets, Sun, Clock, ArrowUp, Loader2, AlertTriangle } from "lucide-react"
import { getTreks } from "@/lib/api"
import type { Trek } from "@/lib/api"

// Weather API response type (matches /weather/{lat}/{lon})
type WeatherData = {
  temp: number
  feels_like: number
  temp_min: number
  temp_max: number
  humidity: number
  pressure: number
  visibility: number
  wind_speed: number
  wind_deg: number
  wind_gust?: number
  clouds: number
  rain_1h: number
  snow_1h: number
  weather_id: number
  weather_main: string
  weather_desc: string
  weather_icon: string
  sunrise: number
  sunset: number
  location_name: string
  country: string
  dt: number
}

type RiskData = {
  score: number
  label: string
  color: string
  factors: { label: string; severity: string }[]
}

type TrekWeatherResponse = {
  weather: WeatherData
  risk: RiskData
}

type TrekExplorerProps = {}

export default function TrekExplorer({}: TrekExplorerProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Trek[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Selected trek details
  const [selectedTrek, setSelectedTrek] = useState<Trek | null>(null)
  const [weather, setWeather] = useState<TrekWeatherResponse | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState("")

  // Map state
  const [mapUrl, setMapUrl] = useState("")

  // Debounced fetch of treks
  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true)
      try {
        const data = await getTreks({ q: query, limit: 10 })
        setResults(data)
        setSelectedIndex(-1)
      } catch (err) {
        console.error("Failed to fetch treks:", err)
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [query])

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch weather for selected trek
  const fetchWeather = async (trek: Trek) => {
    if (!trek.lat || !trek.lon) {
      setWeatherError("No coordinates available for this trek")
      return
    }

    setWeatherLoading(true)
    setWeatherError("")
    setWeather(null)

    try {
      const res = await fetch(`http://localhost:8000/weather/${trek.lat}/${trek.lon}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.detail || "Failed to load weather")
      }
      const data: TrekWeatherResponse = await res.json()
      setWeather(data)
    } catch (err: any) {
      setWeatherError(err.message)
    } finally {
      setWeatherLoading(false)
    }
  }

  // Generate static map URL (OpenStreetMap static map via staticmap.openstreetmap.de)
  const generateMapUrl = (trek: Trek) => {
    if (!trek.lat || !trek.lon) return
    const zoom = 12
    const size = "600x300"
    const url = `https://staticmap.openstreetmap.de/staticmap.php?center=${trek.lat},${trek.lon}&zoom=${zoom}&size=${size}&markers=${trek.lat},${trek.lon},red-pushpin`
    setMapUrl(url)
  }

  // Handle trek selection
  const handleTrekSelect = (trek: Trek) => {
    setSelectedTrek(trek)
    setQuery(trek.name)
    setShowDropdown(false)
    setSelectedIndex(-1)
    fetchWeather(trek)
    generateMapUrl(trek)
  }

  // Keyboard navigation for search
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown": {
        e.preventDefault()
        if (!showDropdown) {
          setShowDropdown(true)
        } else if (selectedIndex < results.length - 1) {
          setSelectedIndex((prev) => prev + 1)
        }
        break
      }
      case "ArrowUp": {
        e.preventDefault()
        if (selectedIndex > 0) {
          setSelectedIndex((prev) => prev - 1)
        } else if (selectedIndex === 0) {
          setSelectedIndex(-1)
        }
        break
      }
      case "Enter": {
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleTrekSelect(results[selectedIndex])
        } else if (query.trim()) {
          // Manual entry - create a trek object with the query as name
          const manualTrek: Trek = {
            id: "",
            name: query.trim(),
            difficulty: "",
            distance_km: 0,
            location: "",
            elevation_m: null,
            lat: null,
            lon: null,
          }
          handleTrekSelect(manualTrek)
        }
        break
      }
      case "Escape": {
        setShowDropdown(false)
        setSelectedIndex(-1)
        inputRef.current?.blur()
        break
      }
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setShowDropdown(true)
    setSelectedIndex(-1)
    // Clear selection when user starts typing again
    if (selectedTrek && value !== selectedTrek.name) {
      setSelectedTrek(null)
      setWeather(null)
      setMapUrl("")
    }
  }

  const handleInputFocus = () => {
    if (query.trim() || results.length > 0) {
      setShowDropdown(true)
    }
  }

  const difficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case "easy": return "text-emerald-400"
      case "medium": return "text-amber-400"
      case "hard": return "text-red-400"
      default: return "text-white/60"
    }
  }

  const riskColor = (color: string) => {
    switch (color) {
      case "red": return "text-red-400 border-red-400/30 bg-red-400/10"
      case "amber": return "text-amber-400 border-amber-400/30 bg-amber-400/10"
      case "green": return "text-emerald-400 border-emerald-400/30 bg-emerald-400/10"
      default: return "text-white/60 border-white/10 bg-white/5"
    }
  }

  const formatTime = (timestamp: number) => {
    if (!timestamp) return "--"
    const date = new Date(timestamp * 1000)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen bg-black pt-24 pb-16 px-6">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-black to-black pointer-events-none" />

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1 rounded-full mb-4">
            <Search className="w-3 h-3" />
            Trek Explorer
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Explore Any <span className="text-emerald-400">Trek</span>
          </h1>
          <p className="text-white/50 max-w-xl mx-auto">
            Search for a trek to see weather conditions, trail details, and a map of the route.
          </p>
        </div>

        {/* Search Bar */}
        <div className={`relative max-w-2xl mx-auto ${selectedTrek ? "mb-12" : ""}`}>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={handleInputFocus}
              placeholder="Search for a trek..."
              className="w-full bg-black border border-white/10 rounded-xl px-12 py-3 pl-10 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors text-lg"
              autoComplete="off"
              aria-autocomplete="list"
              aria-controls="trek-explorer-results"
              aria-expanded={showDropdown && results.length > 0}
              role="combobox"
            />
            {loading && (
              <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 animate-spin" aria-hidden="true" />
            )}
          </div>

          {showDropdown && results.length > 0 && (
            <div
              ref={dropdownRef}
              id="trek-explorer-results"
              className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden"
              role="listbox"
            >
              {results.map((trek, index) => (
                <button
                  key={trek.id || index}
                  type="button"
                  onClick={() => handleTrekSelect(trek)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full text-left px-4 py-3 transition-colors ${
                    index === selectedIndex
                      ? "bg-emerald-500/20 text-white"
                      : "text-white/80 hover:bg-white/5"
                  }`}
                  role="option"
                  aria-selected={index === selectedIndex}
                >
                  <div className="font-medium">{trek.name}</div>
                  <div className="text-white/40 text-sm mt-0.5">
                    {trek.distance_km} km · {trek.location}
                    {trek.elevation_m && ` · ${trek.elevation_m}m`}
                  </div>
                </button>
              ))}
            </div>
          )}

          {showDropdown && query.trim() && results.length === 0 && !loading && (
            <div
              ref={dropdownRef}
              className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl px-4 py-3 text-white/40 text-sm"
            >
              No treks found. Try different keywords.
            </div>
          )}
        </div>

        {/* Empty State */}
        {!selectedTrek && (
          <div className="text-center max-w-md mx-auto mt-16">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-white text-lg font-semibold mb-2">Start exploring</h2>
            <p className="text-white/40 text-sm">
              Search for a trek above to see weather conditions, trail details, and a map of the route.
            </p>
          </div>
        )}

        {/* Trek Details */}
        {selectedTrek && (
          <div className="space-y-6">
            {/* Trek Header Card */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selectedTrek.name}</h2>
                  <div className="flex items-center gap-2 text-white/50 text-sm">
                    <MapPin className="w-4 h-4" />
                    {selectedTrek.location || "Location not specified"}
                  </div>
                </div>
                {selectedTrek.difficulty && (
                  <div className={`px-3 py-1 rounded-full text-sm font-medium border ${difficultyColor(selectedTrek.difficulty)} border-white/10 bg-white/5`}>
                    {selectedTrek.difficulty}
                  </div>
                )}
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-white/40 text-xs mb-1">Distance</div>
                  <div className="text-white font-semibold flex items-center gap-2">
                    <Mountain className="w-4 h-4 text-emerald-400" />
                    {selectedTrek.distance_km} km
                  </div>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-white/40 text-xs mb-1">Elevation</div>
                  <div className="text-white font-semibold flex items-center gap-2">
                    <ArrowUp className="w-4 h-4 text-emerald-400" />
                    {selectedTrek.elevation_m ? `${selectedTrek.elevation_m} m` : "N/A"}
                  </div>
                </div>
                <div className="bg-black/40 rounded-xl p-4">
                  <div className="text-white/40 text-xs mb-1">Coordinates</div>
                  <div className="text-white font-semibold text-sm">
                    {selectedTrek.lat && selectedTrek.lon
                      ? `${selectedTrek.lat.toFixed(3)}, ${selectedTrek.lon.toFixed(3)}`
                      : "N/A"}
                  </div>
                </div>
              </div>
            </div>

            {/* Weather Section */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <Thermometer className="w-5 h-5 text-emerald-400" />
                Current Weather
              </h3>

              {weatherLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
              )}

              {weatherError && (
                <div className="text-red-400 text-sm flex items-center gap-2 py-4">
                  <AlertTriangle className="w-4 h-4" />
                  {weatherError}
                </div>
              )}

              {weather && !weatherLoading && (
                <div className="space-y-4">
                  {/* Main weather display */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-4xl font-bold text-white">{Math.round(weather.weather.temp)}°C</div>
                      <div className="text-white/50 text-sm capitalize">{weather.weather.weather_desc}</div>
                    </div>
                    <div className="text-right text-white/60 text-sm">
                      <div>Feels like {Math.round(weather.weather.feels_like)}°C</div>
                      <div>H: {Math.round(weather.weather.temp_max)}° L: {Math.round(weather.weather.temp_min)}°</div>
                    </div>
                  </div>

                  {/* Weather grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                    <div className="bg-black/40 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                        <Wind className="w-3 h-3" /> Wind
                      </div>
                      <div className="text-white text-sm font-medium">{weather.weather.wind_speed} m/s</div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                        <Droplets className="w-3 h-3" /> Humidity
                      </div>
                      <div className="text-white text-sm font-medium">{weather.weather.humidity}%</div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Pressure
                      </div>
                      <div className="text-white text-sm font-medium">{weather.weather.pressure} hPa</div>
                    </div>
                    <div className="bg-black/40 rounded-lg p-3">
                      <div className="text-white/40 text-xs mb-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Visibility
                      </div>
                      <div className="text-white text-sm font-medium">{(weather.weather.visibility / 1000).toFixed(1)} km</div>
                    </div>
                  </div>

                  {/* Sun times */}
                  <div className="flex items-center gap-6 text-white/50 text-sm bg-black/40 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-amber-400" />
                      Sunrise: {formatTime(weather.weather.sunrise)}
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="w-4 h-4 text-orange-400" />
                      Sunset: {formatTime(weather.weather.sunset)}
                    </div>
                  </div>

                  {/* Risk Assessment */}
                  <div className={`rounded-xl p-4 border ${riskColor(weather.risk.color)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold">Trek Risk Assessment</span>
                      <span className="text-xl font-bold">{weather.risk.score}/100</span>
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <AlertTriangle className="w-4 h-4" />
                      <span className="font-medium">{weather.risk.label}</span>
                    </div>
                    {weather.risk.factors.length > 0 && (
                      <div className="space-y-1">
                        {weather.risk.factors.map((factor, idx) => (
                          <div key={idx} className="text-sm text-white/70 flex items-center gap-2">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              factor.severity === "high" ? "bg-red-400" :
                              factor.severity === "medium" ? "bg-amber-400" : "bg-emerald-400"
                            }`} />
                            {factor.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Map Section */}
            <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-emerald-400" />
                Trek Location
              </h3>

              {!mapUrl && selectedTrek.lat && selectedTrek.lon && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
                </div>
              )}

              {!selectedTrek.lat || !selectedTrek.lon ? (
                <div className="text-white/40 text-sm text-center py-8">
                  No map coordinates available for this trek.
                </div>
              ) : (
                <div className="relative rounded-xl overflow-hidden bg-black">
                  {mapUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={mapUrl}
                      alt={`Map showing ${selectedTrek.name}`}
                      className="w-full h-64 object-cover"
                      onError={() => setMapUrl("")}
                    />
                  )}
                  {!mapUrl && (
                    <div className="h-64 flex items-center justify-center text-white/40 text-sm">
                      Map unavailable
                    </div>
                  )}
                </div>
              )}

              {selectedTrek.lat && selectedTrek.lon && (
                <div className="mt-3 text-white/40 text-xs text-center">
                  Coordinates: {selectedTrek.lat.toFixed(4)}, {selectedTrek.lon.toFixed(4)}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
