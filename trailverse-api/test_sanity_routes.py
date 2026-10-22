#!/usr/bin/env python3
"""
Route Sanity Check Script for TrailVerse API:
Discovers all registered routes from FastAPI app and sends safe probe requests
to verify every route responds properly without crashing or throwing 500 errors.
"""
import asyncio
import httpx
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))
from main import app

API_BASE = "http://127.0.0.1:8000"

# (Method, Path) -> (status_codes_accepted, params, json_body)
SAFE_PROBES = {
    ("GET", "/"): ([200], None, None),
    ("GET", "/treks"): ([200], {"limit": 2}, None),
    ("GET", "/treks/{trek_id}/coordinates"): ([404], None, None),
    ("PATCH", "/treks/{trek_id}/coordinates"): ([422], None, {}),
    ("POST", "/treks/log"): ([422], None, {}),
    ("GET", "/weather/{lat}/{lon}"): ([200], None, None),
    ("GET", "/groups"): ([200], None, None),
    ("POST", "/groups/create"): ([422], None, {}),
    ("GET", "/groups/{group_id}"): ([404], None, None),
    ("PUT", "/groups/{group_id}"): ([422], None, {}),
    ("POST", "/groups/{group_id}/join"): ([422], None, {}),
    ("DELETE", "/groups/{group_id}/leave"): ([400, 422], None, None),
    ("POST", "/groups/{group_id}/members"): ([422], None, {}),
    ("GET", "/groups/{group_id}/messages"): ([404], None, None),
    ("POST", "/groups/{group_id}/messages"): ([422], None, {}),
    ("GET", "/groups/{group_id}/queries"): ([404, 422], {"viewer_username": "nonexistent_test_user_xyz"}, None),
    ("POST", "/groups/{group_id}/queries"): ([422], None, {}),
    ("POST", "/groups/{group_id}/queries/{query_id}/reply"): ([422], None, {}),
    ("GET", "/dashboard/{username}"): ([404], None, None),
    ("GET", "/users/{username}"): ([404], None, None),
    ("GET", "/users/{username}/groups"): ([200, 404], None, None),
    ("GET", "/search/wikidata"): ([200], {"q": "Kalsubai", "limit": 2}, None),
    ("GET", "/search/osm"): ([200], {"q": "Kalsubai", "limit": 2}, None),
    ("GET", "/search/nominatim"): ([200], {"q": "Kalsubai", "limit": 2}, None),
    ("GET", "/search/owm"): ([200], {"q": "Kalsubai", "limit": 2}, None),
    ("GET", "/search/external"): ([200], {"q": "Kalsubai", "limit": 2}, None),
    ("POST", "/auth/login"): ([400, 401, 422], None, {"username": "probe_user", "password": "wrong"}),
    ("POST", "/auth/signup"): ([422], None, {}),
    ("POST", "/admin/treks/import"): ([422, 503], None, {}),
    ("POST", "/admin/add-state-column"): ([200], None, {}),
    ("POST", "/admin/execute-sql"): ([422], None, {}),
    ("GET", "/docs"): ([200], None, None),
    ("GET", "/docs/oauth2-redirect"): ([200], None, None),
    ("GET", "/redoc"): ([200], None, None),
    ("GET", "/openapi.json"): ([200], None, None),
}


async def run_route_sanity():
    print("\n=======================================================")
    print("🔍  FASTAPI ROUTE SANITY CHECK")
    print("=======================================================")

    registered_routes = []
    for route in app.routes:
        if hasattr(route, "path") and hasattr(route, "methods"):
            for m in route.methods:
                if m != "HEAD":
                    registered_routes.append((m, route.path))

    print(f"Total registered route endpoints: {len(registered_routes)}\n")

    results = []
    async with httpx.AsyncClient(base_url=API_BASE, timeout=10) as client:
        for method, path in sorted(registered_routes):
            # Substitute path parameters for testing
            test_path = path.replace("{lat}", "19.5981").replace("{lon}", "73.7187")
            test_path = test_path.replace("{username}", "nonexistent_test_user_xyz")
            test_path = test_path.replace("{group_id}", "nonexistent-group-id-1234")
            test_path = test_path.replace("{trek_id}", "nonexistent-trek-id-1234")
            test_path = test_path.replace("{query_id}", "nonexistent-query-id-1234")

            # Look up probe config
            probe = SAFE_PROBES.get((method, path))
            accepted = probe[0] if probe else [200, 400, 401, 404, 422, 503]
            params = probe[1] if probe else None
            json_body = probe[2] if probe else None

            try:
                if method == "GET":
                    resp = await client.get(test_path, params=params)
                elif method == "POST":
                    resp = await client.post(test_path, json=json_body)
                elif method == "PUT":
                    resp = await client.put(test_path, json=json_body)
                elif method == "DELETE":
                    resp = await client.delete(test_path, params=params)
                elif method == "PATCH":
                    resp = await client.patch(test_path, json=json_body)
                else:
                    continue

                status = resp.status_code
                is_ok = status in accepted and status != 500
                mark = "✅" if is_ok else "❌"
                print(f"{mark} {method:6} {path:45} -> HTTP {status} (Expected: {accepted})")
                results.append((method, path, status, is_ok))
            except Exception as e:
                print(f"❌ {method:6} {path:45} -> Exception: {e}")
                results.append((method, path, str(e), False))

    print("\n=======================================================")
    print("📊  ROUTE SANITY CHECK SUMMARY")
    print("=======================================================")
    passed = sum(1 for r in results if r[3])
    failed = sum(1 for r in results if not r[3])
    print(f"Total Routes Tested : {len(results)}")
    print(f"Passed              : {passed}")
    print(f"Failed (500/Crash)  : {failed}")

    assert failed == 0, f"{failed} route(s) failed sanity check!"
    print("\n🎉 ALL REGISTERED ROUTES EXIST AND RESPOND HEALTHILY!\n")



if __name__ == "__main__":
    asyncio.run(run_route_sanity())
