"""
Wikidata → Supabase trek importer.

Query the Wikidata SPARQL endpoint for Indian treks / peaks / hiking trails,
transform the results to the TrailVerse `treks` schema, and upsert them into
Supabase.

Run with:
    python scripts/import_treks.py

Dependencies: httpx, supabase, python-dotenv (all already in the venv).

Note: Requires SUPABASE_SERVICE_ROLE_KEY in .env to bypass RLS and write data.
      With only SUPABASE_KEY (anon), the script will fetch and transform data
      but cannot insert/update due to Row Level Security.
"""

import asyncio
import os
import sys
import uuid
from urllib.parse import quote

import httpx
from dotenv import load_dotenv
from supabase import create_client

# ───────────────────────────────────────────────────────────
# Config
# ───────────────────────────────────────────────────────────

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

WIKIDATA_SPARQL = "https://query.wikidata.org/sparql"
USER_AGENT = "TrailVerse/1.0 (trailverse trek importer; contact: dev@trailverse.app)"

# FastAPI admin endpoint
API_BASE = "http://localhost:8000"

# Wikipedia-style type IDs we treat as "treks / peaks / trails"
#   Q8502    = mountain
#   Q22338   = mountain peak
#   Q2491206 = hiking trail
#   Q2238215 = mountain range
#   Q308669  = summit
#   Q194552  = volcano (incl. some Indian peaks)
INSTANCE_OF_IDS = ["Q8502", "Q22338", "Q2491206", "Q2238215", "Q308669", "Q194552"]

# Wikidata property IDs used in the query
#   P17   = country
#   P31   = instance of
#   P625  = coordinate location
#   P2044 = elevation above sea level
#   P131  = located in administrative territorial entity
#   P2043 = length
#   P1448 = official name (fallback for English label)

# SPARQL: find items in India that are peaks / mountains / hiking trails,
# and pull the most useful attributes. OPTIONAL clauses keep the query
# robust when a property is missing.
SPARQL_QUERY = """
SELECT DISTINCT ?item ?itemLabel ?coord ?elevation ?locLabel ?length WHERE {
  VALUES ?type { wd:Q8502 wd:Q22338 wd:Q2491206 wd:Q2238215 wd:Q308669 wd:Q194552 }
  ?item wdt:P31 ?type ;
        wdt:P17 wd:Q668 .
  OPTIONAL { ?item wdt:P625 ?coord . }
  OPTIONAL { ?item wdt:P2044 ?elevation . }
  OPTIONAL { ?item wdt:P131 ?loc . }
  OPTIONAL { ?item wdt:P2043 ?length . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en" . }
}
LIMIT 1000
"""

# ───────────────────────────────────────────────────────────
# Supabase client (reuses the exact pattern from main.py)
# ───────────────────────────────────────────────────────────

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env", file=sys.stderr)
    sys.exit(1)

# Use service role key if available (bypasses RLS for writes)
write_key = SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY
supabase = create_client(SUPABASE_URL, write_key)

if not SUPABASE_SERVICE_ROLE_KEY:
    print("⚠️  WARNING: SUPABASE_SERVICE_ROLE_KEY not set in .env")
    print("   Using anon key - writes will fail due to Row Level Security.")
    print("   Add SUPABASE_SERVICE_ROLE_KEY to .env to enable imports.")
    print()


# ───────────────────────────────────────────────────────────
# Helpers
# ───────────────────────────────────────────────────────────

def parse_point(coord_literal: str):
    """
    Wikidata returns coordinates as a WKT-like literal:
        "Point(77.23 19.01)"^^<http://www.opengis.net/ont/geosparql#wktLiteral>
    Return (lon, lat) floats, or (None, None) if it can't be parsed.
    """
    if not coord_literal:
        return None, None
    try:
        # Strip the datatype suffix if present
        value = coord_literal.split('"')[1] if '"' in coord_literal else coord_literal
        value = value.strip()
        if value.lower().startswith("point("):
            inner = value[value.index("(") + 1: value.rindex(")")]
            lon, lat = inner.split()
            return float(lon), float(lat)
    except (ValueError, IndexError):
        return None, None
    return None, None


def transform(binding: dict) -> dict | None:
    """
    Turn one SPARQL result binding into a TrekOut-shaped dict.
    Returns None if the record is unusable (no name, no location anchor).
    """
    name = (binding.get("itemLabel") or {}).get("value", "").strip()
    if not name:
        return None

    loc = (binding.get("locLabel") or {}).get("value", "").strip()
    # Fall back to the country name if no admin region is present
    location = loc if loc else "India"

    lat, lon = parse_point((binding.get("coord") or {}).get("value", ""))

    elevation_raw = (binding.get("elevation") or {}).get("value", "")
    elevation_m = None
    try:
        elevation_m = int(float(elevation_raw)) if elevation_raw else None
    except ValueError:
        elevation_m = None

    length_raw = (binding.get("length") or {}).get("value", "")
    distance_km = 0.0
    try:
        distance_km = float(length_raw) if length_raw else 0.0
    except ValueError:
        distance_km = 0.0

    return {
        # UUID so each upsert row is addressable; we still dedupe by
        # (name, location) at the DB layer via the unique index.
        "id": str(uuid.uuid4()),
        "name": name,
        "difficulty": None,                # Wikidata has no difficulty data
        "distance_km": distance_km,
        "location": location,
        "elevation_m": elevation_m,
        "lat": lat,
        "lon": lon,
        "state": "Maharashtra",
    }


async def fetch_wikidata() -> list[dict]:
    """Run the SPARQL query against Wikidata with polite rate handling."""
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/sparql-results+json",
    }
    params = {
        "query": SPARQL_QUERY,
        "format": "json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(
            WIKIDATA_SPARQL,
            params=params,
            headers=headers,
        )

    if resp.status_code == 429:
        raise RuntimeError("Wikidata rate-limited (429). Try again later.")
    resp.raise_for_status()

    data = resp.json()
    bindings = data.get("results", {}).get("bindings", [])
    print(f"Fetched {len(bindings)} raw rows from Wikidata")
    return bindings


async def import_via_api(treks: list[dict]) -> dict:
    """Import treks via the FastAPI admin endpoint."""
    headers = {
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=120) as client:
        resp = await client.post(
            f"{API_BASE}/admin/treks/import",
            json={"treks": treks},
            headers=headers,
        )
    resp.raise_for_status()
    return resp.json()


# ───────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────

async def main():
    print("── TrailVerse Wikidata trek import ──")

    bindings = await fetch_wikidata()

    treks = []
    skipped = 0
    for b in bindings:
        t = transform(b)
        if t is None:
            skipped += 1
            continue
        treks.append(t)

    print(f"Transformed {len(treks)} treks ({skipped} skipped as unusable)")

    # Send to API in batches
    chunk_size = 100
    total_success = 0
    total_failed = 0

    for i in range(0, len(treks), chunk_size):
        chunk = treks[i:i + chunk_size]
        print(f"  Sending chunk {i//chunk_size + 1} ({len(chunk)} treks)...")
        try:
            result = await import_via_api(chunk)
            total_success += result.get("imported", 0)
            total_failed += result.get("failed", 0)
            print(f"  ... {result.get('message', 'Done')}")
        except Exception as e:
            print(f"  ! Failed to import chunk: {e}")
            total_failed += len(chunk)

    print("── Import complete ──")
    print(f"  Total fetched : {len(bindings)}")
    print(f"  Imported OK   : {total_success}")
    print(f"  Failed        : {total_failed}")
    print(f"  Skipped       : {skipped}")


if __name__ == "__main__":
    asyncio.run(main())
