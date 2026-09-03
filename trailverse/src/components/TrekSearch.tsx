"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, ChevronDown, Loader2 } from "lucide-react"
import { getTreks } from "@/lib/api"
import type { Trek } from "@/lib/api"

type TrekSearchProps = {
  onSelect: (trek: Trek) => void
  placeholder?: string
  className?: string
}

export default function TrekSearch({ onSelect, placeholder = "Search for a trek...", className = "" }: TrekSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<Trek[]>([])
  const [loading, setLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Debounced fetch
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

  // Click outside to close
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

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
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
            onSelect(results[selectedIndex])
            setQuery(results[selectedIndex].name)
            setShowDropdown(false)
            setSelectedIndex(-1)
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
              state: null,
            }
            onSelect(manualTrek)
            setShowDropdown(false)
            setSelectedIndex(-1)
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
    },
    [showDropdown, selectedIndex, results, query, onSelect]
  )

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    setShowDropdown(true)
    setSelectedIndex(-1)
  }

  const handleResultClick = (trek: Trek) => {
    onSelect(trek)
    setQuery(trek.name)
    setShowDropdown(false)
    setSelectedIndex(-1)
    inputRef.current?.blur()
  }

  const handleInputFocus = () => {
    if (query.trim() || results.length > 0) {
      setShowDropdown(true)
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" aria-hidden="true" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          placeholder={placeholder}
          className="w-full bg-black border border-white/10 rounded-xl px-12 py-3 pl-10 text-white placeholder-white/20 focus:outline-none focus:border-emerald-500 transition-colors"
          autoComplete="off"
          aria-autocomplete="list"
          aria-controls="trek-search-results"
          aria-expanded={showDropdown && results.length > 0}
          role="combobox"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30 animate-spin" aria-hidden="true" />
        )}
        {!loading && (
          <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" aria-hidden="true" />
        )}
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          id="trek-search-results"
          className="absolute z-50 w-full mt-2 bg-zinc-900 border border-white/10 rounded-xl shadow-xl overflow-hidden"
          role="listbox"
        >
          {results.length === 0 && query.trim() ? (
            <div className="px-4 py-3 text-white/40 text-sm" role="option" aria-disabled="true">
              No treks found. Try different keywords.
            </div>
          ) : (
            results.map((trek, index) => (
              <button
                key={trek.id || index}
                type="button"
                onClick={() => handleResultClick(trek)}
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
            ))
          )}
        </div>
      )}
    </div>
  )
}