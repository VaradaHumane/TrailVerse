"use client"

import { useEffect, useRef, useState, useMemo } from "react"
import {
  Mountain,
  MapPin,
  Shield,
  User,
  Compass,
  ArrowUpRight,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Layers,
  Thermometer,
  Wind,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  X,
} from "lucide-react"
import type { TrekWithRisk } from "@/lib/api"
import "leaflet/dist/leaflet.css"

type InteractiveTrailMapProps = {
  treks: TrekWithRisk[]
  selectedTrekId?: string | null
  onSelectTrek?: (trek: TrekWithRisk) => void
  currentUser?: string | null
}

export default function InteractiveTrailMap({
  treks,
  selectedTrekId,
  onSelectTrek,
  currentUser,
}: InteractiveTrailMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<{ [key: string]: any }>({})

  const [activeTrek, setActiveTrek] = useState<TrekWithRisk | null>(null)
  const [mapReady, setMapReady] = useState(false)

  // Filter out treks without valid lat/lon
  const validTreks = useMemo(
    () => treks.filter((t) => typeof t.lat === "number" && typeof t.lon === "number"),
    [treks]
  )

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === "undefined" || !mapContainerRef.current) return
    if (mapInstanceRef.current) return

    let isMounted = true

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current || mapInstanceRef.current) return

      // Default Center: Western Ghats / Sahyadri heartland (Maharashtra)
      const defaultCenter: [number, number] = [19.1, 73.8]
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: 8,
        minZoom: 4,
        maxZoom: 18,
        zoomControl: false,
      })

      // Add Zoom Control at bottom right
      L.control.zoom({ position: "bottomright" }).addTo(map)

      // Add CartoDB Dark Matter tile layer for premium dark aesthetic
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap',
        subdomains: "abcd",
        maxZoom: 19,
      }).addTo(map)

      mapInstanceRef.current = map
      setMapReady(true)
    })

    return () => {
      isMounted = false
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  // Update Markers on Map when treks or selectedTrekId change
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || typeof window === "undefined") return

    import("leaflet").then((L) => {
      const map = mapInstanceRef.current
      if (!map) return

      // Clear previous markers
      Object.values(markersRef.current).forEach((marker: any) => marker.remove())
      markersRef.current = {}

      if (validTreks.length === 0) return

      const bounds = L.latLngBounds([])

      validTreks.forEach((trek) => {
        const lat = trek.lat as number
        const lon = trek.lon as number
        bounds.extend([lat, lon])

        // Determine pin colors based on difficulty & risk
        const isSelected = trek.id === (activeTrek?.id || selectedTrekId)
        const difficultyColor =
          trek.difficulty === "Easy"
            ? "#10b981" // emerald
            : trek.difficulty === "Hard"
            ? "#ef4444" // red
            : "#f59e0b" // amber

        const riskScore = trek.general_risk?.score ?? 50
        const riskColor =
          riskScore >= 65
            ? "#ef4444"
            : riskScore >= 35
            ? "#f59e0b"
            : "#10b981"

        // Custom HTML Marker with glow pulse
        const iconHtml = `
          <div style="
            position: relative;
            width: ${isSelected ? "38px" : "30px"};
            height: ${isSelected ? "38px" : "30px"};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: transform 0.2s ease;
          ">
            <div style="
              position: absolute;
              inset: 0;
              border-radius: 50%;
              background: ${difficultyColor};
              opacity: ${isSelected ? "0.4" : "0.2"};
              animation: ${isSelected ? "pulse 1.8s infinite" : "none"};
            "></div>
            <div style="
              width: ${isSelected ? "26px" : "20px"};
              height: ${isSelected ? "26px" : "20px"};
              border-radius: 50%;
              background: #18181b;
              border: 2px solid ${difficultyColor};
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.8), 0 0 10px ${difficultyColor}60;
            ">
              <div style="
                width: 6px;
                height: 6px;
                border-radius: 50%;
                background: ${difficultyColor};
              "></div>
            </div>
            ${
              isSelected
                ? `<div style="
                    position: absolute;
                    bottom: -18px;
                    background: #09090b;
                    color: #fff;
                    font-size: 10px;
                    font-weight: bold;
                    padding: 1px 6px;
                    border-radius: 4px;
                    white-space: nowrap;
                    border: 1px solid ${difficultyColor};
                    box-shadow: 0 2px 8px rgba(0,0,0,0.8);
                  ">${trek.name.split(" ")[0]}</div>`
                : ""
            }
          </div>
        `

        const customIcon = L.divIcon({
          html: iconHtml,
          className: "trail-marker-pin",
          iconSize: [isSelected ? 38 : 30, isSelected ? 38 : 30],
          iconAnchor: [isSelected ? 19 : 15, isSelected ? 19 : 15],
        })

        const marker = L.marker([lat, lon], { icon: customIcon }).addTo(map)

        // Marker click handler
        marker.on("click", () => {
          setActiveTrek(trek)
          if (onSelectTrek) onSelectTrek(trek)
          map.flyTo([lat, lon], Math.max(map.getZoom(), 11), { duration: 1.2 })
        })

        markersRef.current[trek.id] = marker
      })

      // If multiple markers exist and no active trek selected, fit bounds
      if (bounds.isValid() && !activeTrek && !selectedTrekId) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 })
      }
    })
  }, [mapReady, validTreks, activeTrek, selectedTrekId, onSelectTrek])

  // If selectedTrekId prop updates from outside, fly to it
  useEffect(() => {
    if (selectedTrekId && mapInstanceRef.current) {
      const match = validTreks.find((t) => t.id === selectedTrekId)
      if (match && typeof match.lat === "number" && typeof match.lon === "number") {
        setActiveTrek(match)
        mapInstanceRef.current.flyTo([match.lat, match.lon], 12, { duration: 1.0 })
      }
    }
  }, [selectedTrekId, validTreks])

  return (
    <div className="relative w-full h-[600px] sm:h-[680px] rounded-3xl overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl">
      {/* MAP CANVAS */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* MAP CONTROLS / OVERLAY STATS */}
      <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2 pointer-events-auto">
        <div className="bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-xs text-white flex items-center gap-2 shadow-lg">
          <Layers className="w-3.5 h-3.5 text-emerald-400" />
          <span className="font-semibold">{validTreks.length} Summits Active</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 bg-black/80 backdrop-blur-md border border-white/15 px-3 py-1.5 rounded-xl text-[11px] text-white/70 shadow-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Easy
          <span className="w-2 h-2 rounded-full bg-amber-400 ml-2"></span> Moderate
          <span className="w-2 h-2 rounded-full bg-red-400 ml-2"></span> Hard / Technical
        </div>
      </div>

      {/* RESET VIEW BUTTON */}
      <button
        onClick={() => {
          if (mapInstanceRef.current && validTreks.length > 0) {
            import("leaflet").then((L) => {
              const bounds = L.latLngBounds([])
              validTreks.forEach((t) => bounds.extend([t.lat as number, t.lon as number]))
              if (bounds.isValid()) {
                mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40], maxZoom: 10 })
                setActiveTrek(null)
              }
            })
          }
        }}
        className="absolute top-4 right-4 z-10 bg-black/80 hover:bg-black border border-white/20 text-white/80 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition-all shadow-lg flex items-center gap-1.5"
      >
        <Compass className="w-3.5 h-3.5 text-emerald-400" />
        Fit All Trails
      </button>

      {/* ACTIVE TREK INSPECTION POPUP CARD */}
      {activeTrek && (
        <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-96 z-20 bg-zinc-900/95 backdrop-blur-xl border border-white/20 rounded-2xl p-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${
                    activeTrek.difficulty === "Easy"
                      ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                      : activeTrek.difficulty === "Hard"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {activeTrek.difficulty}
                </span>
                <span className="text-white/40 text-xs">
                  {activeTrek.state || "Maharashtra"}
                </span>
              </div>
              <h3 className="text-white font-bold text-base leading-tight">
                {activeTrek.name}
              </h3>
              <p className="text-white/50 text-xs flex items-center gap-1 mt-0.5">
                <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                {activeTrek.location}
              </p>
            </div>

            <button
              onClick={() => setActiveTrek(null)}
              className="text-white/40 hover:text-white p-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* TELEMETRY METRICS */}
          <div className="grid grid-cols-3 gap-2 bg-black/50 border border-white/10 rounded-xl p-2.5 text-center">
            <div>
              <span className="text-[10px] text-white/40 block">Elevation</span>
              <span className="text-xs font-bold text-white">
                {activeTrek.elevation_m ? `${activeTrek.elevation_m}m` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Distance</span>
              <span className="text-xs font-bold text-white">
                {activeTrek.distance_km ? `${activeTrek.distance_km}km` : "N/A"}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-white/40 block">Gradient</span>
              <span className="text-xs font-bold text-emerald-400">
                {activeTrek.general_risk?.gradient_m_per_km
                  ? `${activeTrek.general_risk.gradient_m_per_km}m/km`
                  : "Normal"}
              </span>
            </div>
          </div>

          {/* TWO SETS OF AI RISK PREDICTORS */}
          <div className="space-y-2.5">
            {/* 1. General Environmental Risk */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-white/80 flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  General Trail Risk
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeTrek.general_risk?.color === "red"
                      ? "bg-red-500/20 text-red-400 border border-red-500/30"
                      : activeTrek.general_risk?.color === "amber"
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  }`}
                >
                  {activeTrek.general_risk?.label || "Low Risk"} (
                  {activeTrek.general_risk?.score ?? 20}/100)
                </span>
              </div>
              <p className="text-[11px] text-white/50 leading-relaxed">
                {activeTrek.general_risk?.terrain_hazards?.[0] ||
                  "Standard mountain trail without severe vertical exposure."}
              </p>
            </div>

            {/* 2. Personalized User Readiness Risk */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-semibold text-emerald-300 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  For Your Profile
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    activeTrek.personalized_risk?.color === "red"
                      ? "bg-red-500/20 text-red-400"
                      : activeTrek.personalized_risk?.color === "amber"
                      ? "bg-amber-500/20 text-amber-400"
                      : "bg-emerald-500/20 text-emerald-300"
                  }`}
                >
                  {activeTrek.personalized_risk?.readiness_percentage ?? 85}% Ready
                </span>
              </div>
              <p className="text-[11px] text-white/60 leading-relaxed">
                {activeTrek.personalized_risk?.personalized_advice ||
                  "Ideal match based on your fitness level and mountain terrain."}
              </p>
            </div>
          </div>

          {/* ACTION BUTTON */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => {
                if (onSelectTrek) onSelectTrek(activeTrek)
              }}
              className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2 px-3 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <span>Inspect Live Telemetry & Weather</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
