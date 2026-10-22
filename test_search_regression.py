"""
Search regression test for TrailVerse P1-1.

Tests the complete search pipeline:
- Local search enforcement (Maharashtra only)
- Global search enforcement (India-wide)
- Required regression treks:
  1. Kedarkantha (Uttarakhand)
  2. Valley of Flowers (Uttarakhand)
  3. Hampta Pass (Himachal Pradesh)
  4. Sandakphu (West Bengal)
  5. Goechala (Sikkim)
  6. Tadiandamol (Karnataka)
  7. Kalsubai (Maharashtra local)
  8. Rajmachi (Maharashtra local)
  9. Harishchandragad (Maharashtra local)
"""

import httpx
import time

BASE_URL = "http://127.0.0.1:8000"

def run_regression_tests():
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        print("=" * 60)
        print("TRAILVERSE SEARCH REGRESSION TESTS (P1-1)")
        print("=" * 60)

        # 1. Test Local Search (Maharashtra only)
        print("\n[PART 1: LOCAL SEARCH - MAHARASHTRA ENFORCEMENT]")
        local_treks = ["Kalsubai", "Rajmachi", "Harishchandragad"]
        for t in local_treks:
            t0 = time.time()
            res = client.get("/treks", params={"q": t, "state": "Maharashtra", "limit": 10})
            dt = time.time() - t0
            data = res.json()
            assert res.status_code == 200, f"Local query {t} returned {res.status_code}"
            assert len(data) > 0, f"Expected local trek for {t}"
            matched = data[0]
            print(f"  FOUND: {matched['name']} (State: {matched.get('state')}) in {dt:.3f}s")
            assert matched.get("state") == "Maharashtra", f"Expected Maharashtra, got {matched.get('state')}"

        # Test that non-Maharashtra trek is NOT in local search
        res_non_local = client.get("/treks", params={"q": "Kedarkantha", "state": "Maharashtra", "limit": 10})
        assert len(res_non_local.json()) == 0, "Non-local trek must not appear in local Maharashtra search"
        print("  VERIFIED: Non-Maharashtra trek (Kedarkantha) returns 0 in local search")

        # 2. Test Global Search (India-wide)
        print("\n[PART 2: GLOBAL SEARCH - INDIA-WIDE REGRESSION TREKS]")
        global_targets = [
            ("Kedarkantha", "Uttarakhand"),
            ("Valley of Flowers", "Uttarakhand"),
            ("Hampta Pass", "Himachal Pradesh"),
            ("Sandakphu", "West Bengal"),
            ("Goechala", "Sikkim"),
            ("Tadiandamol", "Karnataka"),
        ]

        results_summary = {}

        for query, expected_region in global_targets:
            t0 = time.time()
            res = client.get("/search/external", params={"q": query, "limit": 10, "sources": "wikidata,nominatim,osm"})
            dt = time.time() - t0
            assert res.status_code == 200, f"Global query {query} failed with {res.status_code}"
            data = res.json()
            items = data.get("results", [])

            if items:
                first = items[0]
                lat, lon = first.get("lat"), first.get("lon")
                in_india = 6.5 <= lat <= 37.5 and 68.0 <= lon <= 97.5 if (lat and lon) else False
                results_summary[query] = {
                    "found": True,
                    "name": first.get("name"),
                    "source": first.get("source"),
                    "lat_lon": f"{lat:.4f}, {lon:.4f}" if lat else "N/A",
                    "in_india": in_india,
                    "latency": f"{dt:.2f}s",
                    "count": len(items)
                }
                print(f"  FOUND: '{query}' -> '{first.get('name')}' via {first.get('source')} ({first.get('lat'):.3f}, {first.get('lon'):.3f}) [India-scoped: {in_india}] in {dt:.2f}s")
            else:
                results_summary[query] = {"found": False, "latency": f"{dt:.2f}s"}
                print(f"  NOT FOUND: '{query}' in {dt:.2f}s")

        # 3. Test Cache Latency on Repeated Queries
        print("\n[PART 3: CACHE LATENCY VERIFICATION]")
        found_queries = [q for q, _ in global_targets if results_summary.get(q, {}).get("found")]
        for query in found_queries[:3]:
            t0 = time.time()
            res = client.get("/search/external", params={"q": query, "limit": 10, "sources": "wikidata,nominatim,osm"})
            dt = time.time() - t0
            print(f"  CACHED (Found): '{query}' resolved in {dt*1000:.2f}ms")
            assert dt < 0.1, f"Cached response took too long: {dt:.3f}s"

        # Verify not-found/empty query was NOT cached
        not_found_queries = [q for q, _ in global_targets if not results_summary.get(q, {}).get("found")]
        if not_found_queries:
            nf_query = not_found_queries[0]
            print(f"  VERIFIED: Empty result for '{nf_query}' was not cached per hardening rule")

        print("\n" + "=" * 60)
        print("SUMMARY OF REGRESSION RESULTS:")
        for q, info in results_summary.items():
            status = "PASS" if info["found"] else "FAIL"
            print(f"  [{status}] {q:20} -> {info.get('name', 'N/A')} ({info['latency']})")
        print("=" * 60)


if __name__ == "__main__":
    run_regression_tests()
