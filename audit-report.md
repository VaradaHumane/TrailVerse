# TrailVerse Comprehensive Security & Code Audit Report

**Audit Mode**: READ-ONLY AUDIT  
**Auditor**: Senior Security Engineer & Code Auditor  
**Date**: October 27, 2026  
**Scope**: Full Stack Repository (`trailverse/` Next.js frontend, `trailverse-api/` FastAPI backend, Supabase Database & Auth, SQLite Expenses)  

---

## 1. Executive Summary

### 1.1 Vulnerability & Issue Severity Counts

| Severity | Count | Summary |
| :--- | :---: | :--- |
| **CRITICAL** | **6** | Permissive/Missing Supabase RLS (dump/write any user data), Complete lack of backend auth/token verification, Sensitive data exposure (password hashes in `/users/{username}`), Broken Object Level Authorization (IDOR) on group & expense management, Hardcoded secrets/JWT in source/git, Unprotected admin endpoints. |
| **HIGH** | **6** | Client-side identity spoofing via `localStorage["username"]`, Stored/DOM XSS in Leaflet `L.divIcon`, PostgREST filter string injection, Race condition on `trail_score` increments, 20 npm dependency vulnerabilities, 40 Python pip vulnerabilities. |
| **MEDIUM** | **6** | Misdirected UPI debt settlement in `GroupExpenseSplitter`, React hook re-rendering errors / effect bugs, Missing Pydantic input boundary validations (negative amounts/members), Hardcoded local CORS origins, Missing HTTP security headers & middleware, Local host process binding in scripts. |
| **LOW** | **4** | False marketing claims (Random Forest/XGBoost in UI vs rule-based heuristic backend), Stale hardcoded fallback stats (27 vs 58 trails), Missing rate-limiting on auth/search endpoints, Missing `.env.example` templates. |
| **INFO / DEAD CODE** | **5** | Completely dead file ([src/lib/utils.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/utils.ts)), 6 unused dependencies (`shadcn`, `radix-ui`, `class-variance-authority`, etc.), 4 unused API functions, 4 orphaned backend endpoints, 36 fixable unused imports. |
| **TOTAL** | **27** | **Active findings requiring remediation across Phases.** |

### 1.2 Top 5 Most Urgent Fixes

1. **Enable & Enforce Row Level Security (RLS) on Supabase Tables (`users`, `treks`, `trek_groups`)**:
   Currently, the public `NEXT_PUBLIC_SUPABASE_ANON_KEY` allows any anonymous visitor in DevTools to dump the entire `users` table (names, emails, user IDs, password hashes) and run arbitrary `UPDATE`/`DELETE` queries.
2. **Implement Server-Side Token/JWT Authentication in FastAPI**:
   FastAPI endpoints (`/groups/{id}`, `/treks/log`, `/groups/{id}/expenses`, etc.) do not validate JWTs, bearer tokens, or sessions. They rely entirely on client-supplied usernames, allowing complete impersonation and unauthorized data tampering.
3. **Strip Sensitive Credentials from API Responses (`/users/{username}`)**:
   `GET /users/{username}` returns `select("*")` from the database, leaking users' Argon2 `password_hash` and email addresses to the public web.
4. **Fix Broken Object Level Authorization (IDOR) across Group & Expense Endpoints**:
   `update_group`, `post_message`, `set_group_upi`, `delete_group_expense`, and `settle_expense` trust arbitrary username strings passed in request bodies or query parameters.
5. **Sanitize Leaflet Marker HTML to Prevent Stored/DOM XSS**:
   `InteractiveTrailMap.tsx` directly interpolates `trek.name` into `L.divIcon({ html: ... })` without HTML escaping, allowing arbitrary script execution from external trail data.

---

## 2. Coverage Ledger

Every source file in the repository was inspected line-by-line.

| # | File Path | Status | Details / Scope |
| :---: | :--- | :---: | :--- |
| 1 | [trailverse-api/main.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py) | **Reviewed** | Complete FastAPI backend, 45 endpoints, caching, risk algorithms, Supabase & SQLite queries |
| 2 | [trailverse-api/reset_password.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/reset_password.py) | **Reviewed** | Direct password update script using anon key |
| 3 | [trailverse-api/restart_api.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/restart_api.py) | **Reviewed** | Process supervisor script, subprocess uvicorn launcher |
| 4 | [trailverse-api/scripts/import_treks.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/scripts/import_treks.py) | **Reviewed** | Wikidata SPARQL query importer |
| 5 | [trailverse-api/test_cache.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/test_cache.py) | **Reviewed** | Cache TTL and eviction unit tests |
| 6 | [trailverse-api/test_risk_scoring.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/test_risk_scoring.py) | **Reviewed** | Risk scoring engine unit tests |
| 7 | [trailverse-api/test_sanity_routes.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/test_sanity_routes.py) | **Reviewed** | Endpoint health probe suite |
| 8 | [trailverse-api/requirements.txt](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/requirements.txt) | **Reviewed** | Python package specifications |
| 9 | [trailverse-api/.env](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/.env) | **Reviewed** | Backend secrets, Supabase Service Role Key, OpenWeather API key |
| 10 | [trailverse-api/.gitignore](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/.gitignore) | **Reviewed** | Git ignore rules for backend |
| 11 | [trailverse/package.json](file:///Users/varada/Developer/Projects/trailverse/trailverse/package.json) | **Reviewed** | Frontend dependencies, scripts, versions |
| 12 | [trailverse/tsconfig.json](file:///Users/varada/Developer/Projects/trailverse/trailverse/tsconfig.json) | **Reviewed** | TypeScript compiler configuration |
| 13 | [trailverse/next.config.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/next.config.ts) | **Reviewed** | Next.js configuration and headers |
| 14 | [trailverse/postcss.config.mjs](file:///Users/varada/Developer/Projects/trailverse/trailverse/postcss.config.mjs) | **Reviewed** | PostCSS plugins |
| 15 | [trailverse/eslint.config.mjs](file:///Users/varada/Developer/Projects/trailverse/trailverse/eslint.config.mjs) | **Reviewed** | ESLint configuration |
| 16 | [trailverse/components.json](file:///Users/varada/Developer/Projects/trailverse/trailverse/components.json) | **Reviewed** | shadcn/ui configuration |
| 17 | [trailverse/.gitignore](file:///Users/varada/Developer/Projects/trailverse/trailverse/.gitignore) | **Reviewed** | Frontend git ignore rules |
| 18 | [trailverse/.env.local](file:///Users/varada/Developer/Projects/trailverse/trailverse/.env.local) | **Reviewed** | Frontend public environment variables |
| 19 | [trailverse/src/app/layout.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/layout.tsx) | **Reviewed** | Root HTML layout, font setup, metadata |
| 20 | [trailverse/src/app/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/page.tsx) | **Reviewed** | Landing page assembly (Hero, Features, Footer) |
| 21 | [trailverse/src/app/globals.css](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/globals.css) | **Reviewed** | Core CSS, Tailwind directives |
| 22 | [trailverse/src/app/(auth)/login/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/(auth)/login/page.tsx) | **Reviewed** | Login form, Google OAuth invocation |
| 23 | [trailverse/src/app/(auth)/signup/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/(auth)/signup/page.tsx) | **Reviewed** | Registration form, Google OAuth flow |
| 24 | [trailverse/src/app/auth/callback/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/auth/callback/page.tsx) | **Reviewed** | OAuth callback handler, session sync |
| 25 | [trailverse/src/app/dashboard/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/dashboard/page.tsx) | **Reviewed** | User dashboard, leaderboards, progression recommendations |
| 26 | [trailverse/src/app/explore/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/explore/page.tsx) | **Reviewed** | Trail explorer route wrapper |
| 27 | [trailverse/src/app/search/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/search/page.tsx) | **Reviewed** | Dedicated All-India Global Search route |
| 28 | [trailverse/src/app/features/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/features/page.tsx) | **Reviewed** | Full features catalogue page |
| 29 | [trailverse/src/app/groups/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/groups/page.tsx) | **Reviewed** | Trek groups listing & search |
| 30 | [trailverse/src/app/groups/create/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/groups/create/page.tsx) | **Reviewed** | Trek group creation form |
| 31 | [trailverse/src/app/groups/[id]/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/groups/[id]/page.tsx) | **Reviewed** | Group expedition details, RSVPs, forums, expense tab |
| 32 | [trailverse/src/app/groups/[id]/edit/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/groups/[id]/edit/page.tsx) | **Reviewed** | Group modification form |
| 33 | [trailverse/src/app/profile/[username]/page.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/app/profile/[username]/page.tsx) | **Reviewed** | Public user profile & summit history |
| 34 | [trailverse/src/components/Navbar.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/Navbar.tsx) | **Reviewed** | Main navigation bar, auth state listener |
| 35 | [trailverse/src/components/Footer.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/Footer.tsx) | **Reviewed** | Application footer & links |
| 36 | [trailverse/src/components/HeroSection.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/HeroSection.tsx) | **Reviewed** | Landing hero banner & stats |
| 37 | [trailverse/src/components/FeaturesSection.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/FeaturesSection.tsx) | **Reviewed** | Feature cards grid |
| 38 | [trailverse/src/components/TrekExplorer.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/TrekExplorer.tsx) | **Reviewed** | Maharashtra/Global switcher, filters, telemetry dashboard |
| 39 | [trailverse/src/components/TrekSearch.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/TrekSearch.tsx) | **Reviewed** | Autocomplete search combobox |
| 40 | [trailverse/src/components/InteractiveTrailMap.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/InteractiveTrailMap.tsx) | **Reviewed** | Leaflet map, ESRI tile switcher, popup weather |
| 41 | [trailverse/src/components/GroupExpenseSplitter.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/GroupExpenseSplitter.tsx) | **Reviewed** | Expense tracking, debt minimization, UPI pay generation |
| 42 | [trailverse/src/components/LogTrekModal.tsx](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/LogTrekModal.tsx) | **Reviewed** | Modal form to log summit achievements |
| 43 | [trailverse/src/lib/api.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts) | **Reviewed** | Frontend HTTP client, in-memory caching |
| 44 | [trailverse/src/lib/supabaseClient.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/supabaseClient.ts) | **Reviewed** | Supabase JS client configuration |
| 45 | [trailverse/src/lib/utils.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/utils.ts) | **Reviewed** | Unused helper function `cn` |
| 46 | [README.md](file:///Users/varada/Developer/Projects/trailverse/README.md) | **Reviewed** | Documentation, architecture diagrams |
| 47 | [browser_test.py](file:///Users/varada/Developer/Projects/trailverse/browser_test.py) | **Reviewed** | Playwright test script |
| 48 | [browser_test_global.py](file:///Users/varada/Developer/Projects/trailverse/browser_test_global.py) | **Reviewed** | Playwright global test script |
| 49 | [test_browser_all_viewports.py](file:///Users/varada/Developer/Projects/trailverse/test_browser_all_viewports.py) | **Reviewed** | Responsive layout test script |
| 50 | [test_final_verification.py](file:///Users/varada/Developer/Projects/trailverse/test_final_verification.py) | **Reviewed** | End-to-end integration test script |
| 51 | [test_search_regression.py](file:///Users/varada/Developer/Projects/trailverse/test_search_regression.py) | **Reviewed** | Search regression test script |
| 52 | [test_weather_risk_mock.py](file:///Users/varada/Developer/Projects/trailverse/test_weather_risk_mock.py) | **Reviewed** | Weather risk mock test script |

---

## 3. Architecture & Dependency Map

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (Port 3000)                    │
│                                                                        │
│   Pages:                                                               │
│   - / (Landing: HeroSection, FeaturesSection, Footer)                  │
│   - /login, /signup ((auth) with Supabase OAuth & Password)           │
│   - /auth/callback (OAuth exchange)                                    │
│   - /dashboard (Progression, Leaderboards, User stats)                 │
│   - /explore (TrekExplorer: Maharashtra Atlas & Interactive Map)       │
│   - /search (TrekExplorer: All-India Global Discovery)                 │
│   - /groups, /groups/create, /groups/[id], /groups/[id]/edit           │
│   - /profile/[username] (Public trekker dossier)                       │
│                                                                        │
│   State & Client Libs:                                                 │
│   - api.ts (Fetch client + 60s memory cache)                           │
│   - supabaseClient.ts (createClient with Anon Key)                     │
│   - Auth State: localStorage["username"] + storage event listener     │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ HTTP REST (Port 8000)           │ Supabase Auth & DB
                   ▼                                 ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────┐
│       FastAPI Backend (Port 8000)     │  │       Supabase Cloud         │
│                                      │  │                              │
│   Services:                          │  │   Auth: Google OAuth         │
│   - Auth (/auth/signup, /login, sync)│  │   PostgreSQL Tables:         │
│   - Treks & Risk (/treks, with-risk) │◄─┼── - users                    │
│   - Leaderboards (/leaderboard)      │  │   - treks                    │
│   - Groups & Forums (/groups/*)      │  │   - user_treks, user_badges  │
│   - Admin Endpoints (/admin/*)       │  │   - trek_groups              │
│   - Weather Proxy (Open-Meteo)       │  │   - trek_group_members       │
│   - Search (Wikidata, OSM, Overpass) │  │   - trek_group_messages      │
│                                      │  │   - trek_group_queries       │
│   Local DB:                          │  │                              │
│   - expenses.db (SQLite for splits)  │  │   RLS Status: DISABLED/OPEN  │
└──────────────────────────────────────┘  └──────────────────────────────┘
```

---

## 4. Findings Table

| ID | Severity | Category | File:Line | Issue | Evidence | Confidence | Suggested Fix |
| :--- | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **SEC-01** | **CRITICAL** | Authorization / RLS | Supabase DB (`users`, `treks`, `trek_groups`) | Permissive / Disabled RLS allows unauthenticated anonymous dumping & updating of all users and treks. | `anon_client.table('users').select('id, name, username, email, password_hash').execute()` successfully returned full user records with anon key. `anon_client.table('treks').update(...)` allowed. | Confirmed | Enable RLS on `users`, `treks`, `trek_groups`. Add strict policies: `users` SELECT only non-sensitive fields or own row; UPDATE only `auth.uid() = id`. Revoke public UPDATE/DELETE on `treks`. |
| **SEC-02** | **CRITICAL** | Authentication | [trailverse-api/main.py:120-1320](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L120-L1320) | Complete absence of FastAPI authentication dependencies (`Depends`). | Grep for `Depends` in `main.py` returned 0 results. Endpoints rely entirely on client-supplied `username` in JSON body or query string. | Confirmed | Implement a FastAPI dependency `get_current_user(token = Depends(oauth2_scheme))` that validates the Supabase JWT signature via PyJWT or Supabase Auth API. |
| **SEC-03** | **CRITICAL** | Data Leakage | [trailverse-api/main.py:138-162](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L138-L162) | Public user profile endpoint exposes `password_hash` and `email` to anyone. | `result = supabase.table("users").select("*").ilike("username", username).execute()` followed by `return {"user": user}`. | Confirmed | Change `.select("*")` to `.select("id, name, username, city, bio, trail_score, rank, photo, created_at")`. Never include `password_hash` in API output. |
| **SEC-04** | **CRITICAL** | Authorization / IDOR | [trailverse-api/main.py:693](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L693) | Broken Object Level Authorization (IDOR) on group modification, messages, expenses, and UPI settings. | `host = get_user_by_username(body.host_username)` followed by `if host["id"] != group["host_id"]`. Caller supplies `host_username` of the actual host to pass check. | Confirmed | Extract authenticated user identity from the validated JWT token rather than trusting request parameters. |
| **SEC-05** | **CRITICAL** | Secrets in Git | [trailverse/src/lib/supabaseClient.ts:7](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/supabaseClient.ts#L7) | Hardcoded Supabase Anon JWT committed into git history. | Gitleaks commit `07268808d5d26a089fe34867ef3605ec2f9704d3`: `supabaseClient.ts:7`. Fallback string: `"eyJhbGciOiJIUzI1Ni..."`. | Confirmed | Remove fallback string from source code. Require `process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY`. Rotate the key in Supabase dashboard. |
| **SEC-06** | **CRITICAL** | Authorization | [trailverse-api/main.py:2164-2275](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L2164-L2275) | Unprotected admin endpoints (`/admin/treks/import`, `/admin/execute-sql`) callable by unauthenticated users. | `import_treks` only checks `if not SUPABASE_SERVICE_ROLE_KEY: raise HTTPException(503)` without verifying caller credentials. | Confirmed | Protect `/admin/*` routes with an admin authentication dependency or an `ADMIN_API_KEY` header check. |
| **SEC-07** | **HIGH** | Authentication | `trailverse/src/app/*` (Multiple) | Client-side identity assertion spoofing via unvalidated `localStorage["username"]`. | `localStorage.getItem("username")` used across `dashboard`, `groups`, `profile`. Modifying this key in browser DevTools impersonates any user. | Confirmed | Use Supabase Auth session tokens (`session.access_token`) and attach as `Authorization: Bearer <token>` to all backend requests. |
| **SEC-08** | **HIGH** | XSS (DOM/Stored) | [InteractiveTrailMap.tsx:235](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/InteractiveTrailMap.tsx#L235) | Unescaped trek name directly interpolated into Leaflet `L.divIcon({ html })`. | `${isSelected ? \`<div>\${trek.name.split(" ")[0]}</div>\` : ""}`. Malicious names from external search (OSM/Wikidata) execute arbitrary JS. | Confirmed | Escape HTML entities using `encodeURIComponent` or a text node escaping function before passing to Leaflet HTML. |
| **SEC-09** | **HIGH** | Injection | [trailverse-api/main.py:315](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L315) | PostgREST filter string injection via unescaped search parameter. | `query = query.or_(f"name.ilike.%{q}%,location.ilike.%{q}%")`. Characters like `,`, `(`, `)` modify PostgREST filter structure. | Confirmed | Sanitize `q` by stripping commas, parentheses, and dots, or use separate parameterized filter calls. |
| **SEC-10** | **HIGH** | Race Condition | [trailverse-api/main.py:393-404](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L393-L404) | Non-atomic read-modify-write on `trail_score` causes lost updates under concurrency. | `current = supabase.table("users").select("trail_score")... new_score = current + points... supabase.table("users").update({"trail_score": new_score})`. | Confirmed | Use a PostgreSQL RPC function: `CREATE FUNCTION increment_trail_score(user_id uuid, points int) ... UPDATE users SET trail_score = trail_score + points` or atomic SQL increment. |
| **SEC-11** | **HIGH** | Dependencies | [trailverse/package.json](file:///Users/varada/Developer/Projects/trailverse/trailverse/package.json) | 20 known npm vulnerabilities in frontend dependencies (2 Critical, 13 High). | `npm audit` flagged vulnerabilities in `next` (SSRF, DoS, Cache Poisoning), `nanoid`, `sharp`, `postcss`, `proxy-addr`, `zod`. | Confirmed | Upgrade Next.js to `>=16.4.3` or latest stable release and run `npm audit fix`. |
| **SEC-12** | **HIGH** | Dependencies | [trailverse-api/requirements.txt](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/requirements.txt) | 40 known Python package vulnerabilities detected by `pip-audit`. | `pip-audit` flagged CVEs in `pyjwt` (2.13.0 -> 2.14.0+), `starlette` (1.2.1 -> 1.3.1+), `urllib3` (2.7.0 -> 2.8.0+), `cryptography`. | Confirmed | Update `requirements.txt` to include patched package versions and rebuild venv. |
| **BUG-01** | **MEDIUM** | React Hooks | [TrekExplorer.tsx:118](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/TrekExplorer.tsx#L118) & [InteractiveTrailMap.tsx:272](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/InteractiveTrailMap.tsx#L272) | Synchronous `setState` inside `useEffect` bodies causing cascading re-renders and temporal access bugs. | ESLint `react-hooks/set-state-in-effect` and `react-hooks/immutability` errors. `handleExecuteGlobalSearch` called before declaration. | Confirmed | Move state resets outside effects or hoist function declarations using `useCallback`. |
| **BUG-02** | **MEDIUM** | Logic Error | [GroupExpenseSplitter.tsx:148-151](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/GroupExpenseSplitter.tsx#L148-L151) | UPI settlement link sends money to the group host instead of the individual creditor. | `const targetUpi = data?.upi?.upi_id || "trekker@upi"`. If member A owes member B, payment is routed to host's UPI. | Confirmed | Store member UPI IDs or prompt for the specific creditor's UPI ID rather than routing all debts to the host. |
| **BUG-03** | **MEDIUM** | Input Validation | [trailverse-api/main.py:650-660](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L650-L660) | Missing boundary validation in Pydantic request models. | `CreateGroupRequest.cost` allows negative values; `max_members` has no upper/lower bounds; `LogTrekRequest.duration_mins` allows negative numbers. | Confirmed | Add Pydantic constraints: `cost: float = Field(..., ge=0)`, `max_members: Optional[int] = Field(None, ge=2, le=500)`, `duration_mins: int = Field(..., gt=0)`. |
| **BUG-04** | **MEDIUM** | CORS Configuration | [trailverse-api/main.py:126](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L126) | Hardcoded localhost origin breaks API on production deployment. | `allow_origins=["http://localhost:3000"]`. Any Vercel or custom domain deployment will be rejected by browser CORS policy. | Confirmed | Read allowed origins from an environment variable: `ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")`. |
| **BUG-05** | **MEDIUM** | Security Headers | [trailverse/next.config.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/next.config.ts) | Complete lack of HTTP security headers (CSP, X-Frame-Options, HSTS). | `nextConfig` is empty `{}`. No `headers()` function configured. | Confirmed | Configure `headers()` in `next.config.ts` to add `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. |
| **BUG-06** | **MEDIUM** | System / Process | [trailverse-api/restart_api.py:12-14](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/restart_api.py#L12-L14) | Subprocess executes with hardcoded absolute user home path and binds to `0.0.0.0`. | `'/Users/varada/Developer/Projects/trailverse/trailverse-api/venv/bin/uvicorn'`, `'--host', '0.0.0.0'`. Bandit B104 flagged. | Confirmed | Use `sys.executable` to dynamically resolve python/uvicorn and bind to `127.0.0.1` by default unless explicitly in container mode. |
| **CODE-01** | **LOW** | Code/Doc Mismatch | [FeaturesSection.tsx:34-36](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/FeaturesSection.tsx#L34-L36) | Misleading marketing claims ("Random Forest + XGBoost models") not present in code. | `main.py` uses heuristic rule-based math (`compute_general_trail_risk`). Neither `scikit-learn` nor `xgboost` are in `requirements.txt`. | Confirmed | Update marketing copy to accurately describe TrailVerse's deterministic AI rule engine (Elevation Gradient & Telemetry Risk Evaluator). |
| **CODE-02** | **LOW** | Hardcoded Constants | [HeroSection.tsx:15](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/components/HeroSection.tsx#L15) & [src/lib/api.ts:44](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts#L44) | Stale hardcoded initial stats (`27 trails`) after expanding to 58 summits. | `total_trails: 27` hardcoded in `HeroSection` initial state and `api.ts` error fallback. | Confirmed | Update fallback constant to `total_trails: 58` or fetch dynamically from backend. |
| **CODE-03** | **LOW** | Denial of Service | [trailverse-api/main.py](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py) | No rate-limiting middleware on external search or login/signup endpoints. | Calling `/auth/login` or `/search/external` can be scripted indefinitely without rate limits (429). | Confirmed | Add `slowapi` rate-limiting middleware (e.g. 10 req/min on auth, 60 req/min on search). |
| **CODE-04** | **LOW** | Configuration | Root / Backend | Missing `.env.example` templates in frontend and backend. | `find . -name "*.example*"` returned no files. New contributors cannot know required env variables. | Confirmed | Create `trailverse/.env.example` and `trailverse-api/.env.example` with dummy values. |

---

## 5. Unused & Disconnected Code Table

| Item | Type | Evidence & Proof | Safe to Delete? |
| :--- | :--- | :--- | :---: |
| [src/lib/utils.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/utils.ts) | File | Grep across `src/` for `@/lib/utils` or `src/lib/utils` returned 0 matches. Knip flagged as Unused File. | **Yes** |
| `radix-ui`, `shadcn`, `tw-animate-css`, `class-variance-authority`, `tailwind-merge` | npm Dependencies | `npx depcheck` and `npx knip` verified zero imports across all frontend TSX/CSS files. | **Yes** |
| [getTrekRisk()](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts#L554) | Exported Function | Grep across `src/` returned 0 calls outside its own declaration. Explorer uses `getAllTreksWithRisk`. | **Yes** |
| [getLeaderboard()](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts#L567) | Exported Function | Grep across `src/` returned 0 calls outside its own declaration. Dashboard uses `getDashboardData`. | **Yes** |
| [getNextTrekRecommendation()](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts#L580) | Exported Function | Grep across `src/` returned 0 calls outside its own declaration. Dashboard uses `getDashboardData`. | **Yes** |
| [AbortError](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/api.ts#L29) | Exported Class | Grep across `src/` returned 0 instantiations. | **Yes** |
| [GET /treks/{trek_id}/coordinates](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L321) | FastAPI Route | Grep across `src/` returned 0 callers. | **Verify** (Admin utility) |
| [PATCH /treks/{trek_id}/coordinates](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L333) | FastAPI Route | Grep across `src/` returned 0 callers. | **Verify** (Admin utility) |
| [POST /admin/add-state-column](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L2275) | FastAPI Route | One-off migration route; already executed. | **Yes** |
| [GET /search/owm](file:///Users/varada/Developer/Projects/trailverse/trailverse-api/main.py#L2625) | FastAPI Route | Direct route exposed publicly; only internal callers needed. | **Verify** |
| Unused imports: `JSONResponse`, `md5` (`main.py`), `quote` (`import_treks.py`), `SearchCode`, `Eye` (`TrekExplorer.tsx`) | Imports | Ruff and Vulture flagged with 90% confidence; zero references in file bodies. | **Yes** |

---

## 6. Automated Tooling Output Summary

### 6.1 Gitleaks (Secrets Detection)
- **Scan Scope**: Full git commit history (17 commits) + active source tree.
- **Findings**:
  - [trailverse/src/lib/supabaseClient.ts:7](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/supabaseClient.ts#L7): Hardcoded Supabase Anon JWT committed in `07268808d5d26a089fe34867ef3605ec2f9704d3`.
  - `trailverse-api/.env`: 3 secrets detected in working tree (`OPENWEATHER_API_KEY`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).

### 6.2 Semgrep (Static Analysis SAST)
- **Rules Run**: 452 rules across 36 files.
- **Findings**:
  - `trailverse/src/lib/supabaseClient.ts`: 1 Blocking Code Finding (`generic.secrets.security.detected-jwt-token`).

### 6.3 npm audit (Frontend Dependency Analysis)
- **Total Vulnerabilities**: 20 (2 Critical, 13 High, 5 Moderate).
- **Critical CVEs**:
  - `next`: Middleware bypass, SSRF in Server Actions, RCE in image optimization & caching.
  - `proxy-addr`: IP spoofing via IPv4-mapped IPv6 trust subnet.

### 6.4 pip-audit (Backend Dependency Analysis)
- **Total Vulnerabilities**: 40 known vulnerabilities across 10 packages.
- **Key Vulnerabilities**:
  - `pyjwt` (2.13.0): 14 security advisories (Fixed in 2.14.0+).
  - `starlette` (1.2.1): DoS & Header parsing issues (Fixed in 1.3.1+).
  - `cryptography` (48.0.1): Fixed in 49.0.0+.
  - `urllib3` (2.7.0): Fixed in 2.8.0+.

### 6.5 Bandit (Python AST Security Scanner)
- **Code Scanned**: 3,070 lines in `trailverse-api/`.
- **Issues Found**: 9 total issues.
  - B104 (Medium): Binding to all interfaces `0.0.0.0` in `restart_api.py`.
  - B110 (Low): Silent `try-except-pass` blocks in `main.py` lines 2858 & 2873.
  - B404/B603 (Low): Unchecked `subprocess.Popen` in `restart_api.py`.
  - B105 (Low): Hardcoded password string in `test_sanity_routes.py`.

### 6.6 ESLint & Knip (TypeScript / React Health)
- **ESLint**: 34 problems (11 errors, 23 warnings).
  - `react-hooks/set-state-in-effect`: Synchronous setState inside effect in `TrekExplorer.tsx` and `InteractiveTrailMap.tsx`.
  - `react-hooks/immutability`: `handleExecuteGlobalSearch` accessed before declaration.
- **Knip / Depcheck**:
  - 1 unused source file: [src/lib/utils.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/utils.ts).
  - 6 unused dependencies in `package.json`.
  - 5 unused exported functions/types in `api.ts`.

---

## 7. Prioritized Fix Plan (For Your Approval)

Fixes are organized in logical batches so they can be reviewed and approved incrementally.

### Batch 1: Critical Database & Auth Security (Highest Priority)
1. **Enable Supabase RLS**:
   - Enable RLS on `users`, `treks`, and `trek_groups`.
   - Write policies: Allow public SELECT on `treks`; restrict `users` SELECT to public profile columns; restrict `users` UPDATE to authenticated owner.
2. **Sanitize `/users/{username}` Response**:
   - Exclude `password_hash`, `email`, and private metadata from public profile endpoint.
3. **Remove Hardcoded Secrets**:
   - Remove fallback string from `supabaseClient.ts` and require `.env.local`.
   - Add `.env.example` templates for both frontend and backend.

### Batch 2: Backend Authorization & IDOR Hardening
4. **FastAPI Auth Dependency**:
   - Implement Supabase JWT verification dependency `get_authenticated_user`.
   - Protect `/groups/create`, `/groups/{id}` (PUT), `/groups/{id}/expenses`, `/groups/{id}/messages`, `/treks/log`.
5. **Protect Admin Routes**:
   - Restrict `/admin/*` routes to require a server admin key header.
6. **Fix Group Expense IDOR & UPI Routing**:
   - Ensure only group members can add expenses.
   - Fix UPI payment link generator to route debts to the individual creditor's UPI rather than the host's UPI.

### Batch 3: Injection & DOM Safety
7. **XSS Sanitization in Leaflet**:
   - Escape HTML in `InteractiveTrailMap.tsx` marker generator.
8. **PostgREST Injection Sanitization**:
   - Sanitize search queries before passing to PostgREST `.or_()`.
9. **Atomic Trail Score Increment**:
   - Replace read-modify-write in `log_trek` with an atomic SQL increment.

### Batch 4: React Bugs, Dependencies & Dead Code Clean-up
10. **Fix ESLint React Hook Errors**:
    - Resolve `set-state-in-effect` and hoisting issues in `TrekExplorer.tsx` and `InteractiveTrailMap.tsx`.
11. **Dependency Upgrades**:
    - Run `npm audit fix` / upgrade Next.js to patched version.
    - Upgrade `pyjwt`, `starlette`, `urllib3` in `requirements.txt`.
12. **Purge Dead Code**:
    - Remove [src/lib/utils.ts](file:///Users/varada/Developer/Projects/trailverse/trailverse/src/lib/utils.ts).
    - Prune unused npm dependencies (`shadcn`, `tw-animate-css`, `radix-ui`, `class-variance-authority`).
    - Remove unused exports in `api.ts`.

---

## 8. Things Done Well (What NOT to Touch)

- **Open-Meteo Zero-Cost Weather Engine**:
  - The integration with Open-Meteo (`https://api.open-meteo.com/v1/forecast`) is exceptionally well designed. It provides 10,000+ daily calls with zero API keys and zero cost.
- **TTLCache In-Memory Implementation**:
  - The `TTLCache` class in `main.py` is clean and robust. It includes automatic TTL eviction, max-size boundary checks (500 entries), and explicit guards against caching error payloads.
- **Pure Heuristic Risk Scoring Engine**:
  - `compute_general_trail_risk` and `compute_personalized_trail_risk` are pure, deterministic functions with comprehensive test coverage (18 passing unit tests in `test_risk_scoring.py`).
- **Interactive Leaflet Architecture**:
  - Using Next.js `dynamic(..., { ssr: false })` for Leaflet prevents SSR window crashes. The ESRI Dark Canvas basemap switchers are 100% free and load quickly.
- **Client-Side Cache in `api.ts`**:
  - The 60-second in-memory client cache (`cachedGet`) prevents repetitive network requests when switching tabs between Map and Grid modes.
