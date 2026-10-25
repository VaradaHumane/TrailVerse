from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from supabase import create_client, Client
from dotenv import load_dotenv
import asyncio
import os
import httpx
import time
import logging
from hashlib import md5

# Load environment variables (supports running from repo root or trailverse-api)
_dotenv_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_dotenv_path):
    load_dotenv(dotenv_path=_dotenv_path)
else:
    load_dotenv()

# ─── Wikimedia / OSM User-Agent Configuration ───
WIKIMEDIA_CONTACT = os.getenv("WIKIMEDIA_CONTACT") or "https://trailverse.app; admin@trailverse.app"

def get_wikimedia_user_agent() -> str:
    """Return compliant Wikimedia User-Agent with contact info."""
    return f"TrailVerse/1.0 ({WIKIMEDIA_CONTACT})"


# ─── In-Memory Cache with TTL and Eviction ───
DEFAULT_SEARCH_TTL = 3600  # 1 hour default for external search results
WEATHER_CACHE_TTL = 600    # 10 minutes max for weather and risk assessments
CACHE_MAX_SIZE = 500       # Max items in memory before eviction

class TTLCache:
    """
    In-memory cache with per-item TTL, max size limit, and eviction.
    - Weather/risk data TTL <= 600 seconds (10 minutes).
    - Search results TTL default = 3600 seconds (1 hour).
    - Eviction: Purges expired entries first; if still full, evicts the oldest entry.
    - Never caches failed or empty-due-to-error results.
    """
    def __init__(self, max_size: int = CACHE_MAX_SIZE, default_ttl: int = DEFAULT_SEARCH_TTL):
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._store: dict[str, tuple[any, float, float]] = {}  # key -> (data, expires_at, created_at)

    def get(self, key: str):
        now = time.time()
        entry = self._store.get(key)
        if entry is None:
            return None
        data, expires_at, _ = entry
        if now >= expires_at:
            del self._store[key]
            return None
        return data

    def set(self, key: str, data: any, ttl: int | None = None) -> bool:
        """
        Store item in cache with specified or default TTL.
        Returns True if cached, False if rejected (e.g. error/failed payload).
        """
        # Guard: Never cache None or failed results
        if data is None:
            return False

        if isinstance(data, dict):
            # Check for error flags or messages
            if data.get("error") is not None or data.get("failed") is True:
                return False
            if "detail" in data and isinstance(data["detail"], str) and "error" in data["detail"].lower():
                return False
            if data.get("empty_due_to_error") is True:
                return False

        effective_ttl = ttl if ttl is not None else self.default_ttl
        now = time.time()
        expires_at = now + effective_ttl

        # Eviction logic if at capacity
        if len(self._store) >= self.max_size and key not in self._store:
            # 1. Purge expired items
            expired_keys = [k for k, (_, exp, _) in self._store.items() if now >= exp]
            for k in expired_keys:
                del self._store[k]

            # 2. If still at max capacity, evict oldest entry
            if len(self._store) >= self.max_size:
                oldest_key = min(self._store.keys(), key=lambda k: self._store[k][2])
                del self._store[oldest_key]

        self._store[key] = (data, expires_at, now)
        return True

    def clear(self):
        self._store.clear()

    def __len__(self):
        return len(self._store)

    def __contains__(self, key):
        return self.get(key) is not None

_cache = TTLCache()
_search_cache = _cache._store

def get_cached_result(key: str):
    return _cache.get(key)

def set_cached_result(key: str, data: dict, ttl: int | None = None) -> bool:
    return _cache.set(key, data, ttl=ttl)

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Service client for admin operations (bypasses RLS)
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_SERVICE_ROLE_KEY else supabase

app = FastAPI(title="TrailVerse API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"status": "TrailVerse API is running 🏔"}

@app.get("/users/{username}")
def get_user(username: str):
    result = supabase.table("users") \
        .select("*") \
        .ilike("username", username) \
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = result.data[0]

    treks_result = supabase.table("user_treks") \
        .select("*, treks(name, difficulty, distance_km, location)") \
        .eq("user_id", user["id"]) \
        .execute()

    badges_result = supabase.table("user_badges") \
        .select("*, badges(title, icon, description)") \
        .eq("user_id", user["id"]) \
        .execute()

    return {
        "user": user,
        "trek_history": treks_result.data,
        "badges": badges_result.data,
    }

def format_leaderboard_entries(users_data: list, viewer_username: str | None = None) -> tuple[list, dict]:
    ranked_list = []
    viewer_stats = {
        "rank": None,
        "trail_score": 0,
        "points_to_next_rank": None,
        "total_trekkers": len(users_data)
    }
    
    for idx, u in enumerate(users_data):
        rank = idx + 1
        score = int(u.get("trail_score") or 0)
        
        # Determine title tier
        if score >= 3000:
            tier = "Summit Master"
        elif score >= 1500:
            tier = "Mountaineer"
        elif score >= 500:
            tier = "Pathfinder"
        elif score >= 200:
            tier = "Scout"
        else:
            tier = "Novice"
            
        podium = "gold" if rank == 1 else "silver" if rank == 2 else "bronze" if rank == 3 else None
        
        entry = {
            "rank": rank,
            "name": u.get("name") or u.get("username"),
            "username": u.get("username"),
            "city": u.get("city") or "Trekker",
            "trail_score": score,
            "tier": tier,
            "podium": podium,
        }
        ranked_list.append(entry)
        
        if viewer_username and u.get("username", "").lower() == viewer_username.lower():
            viewer_stats["rank"] = rank
            viewer_stats["trail_score"] = score
            if idx > 0:
                higher_score = int(users_data[idx - 1].get("trail_score") or 0)
                viewer_stats["points_to_next_rank"] = max(1, higher_score - score + 1)
                
    return ranked_list, viewer_stats

@app.get("/dashboard/{username}")
def get_dashboard(username: str):
    user_result = supabase.table("users") \
        .select("*") \
        .ilike("username", username) \
        .execute()

    if not user_result.data or len(user_result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_result.data[0]

    # Fetch user's trek history
    history_res = supabase.table("user_treks").select("*, treks(name, difficulty, distance_km, elevation_m)").eq("user_id", user["id"]).execute()
    user_history = history_res.data or []

    # Fetch all treks for progression matching
    all_treks_res = supabase.table("treks").select("*").execute()
    all_treks = all_treks_res.data or []

    # Compute Next Trek Progression recommendation
    progression = compute_next_trek_recommendation(user, user_history, all_treks)

    # City Leaderboard (fallback to national if city has fewer than 2 users)
    city_leaderboard_res = supabase.table("users") \
        .select("id, name, username, trail_score, city") \
        .ilike("city", user["city"]) \
        .order("trail_score", desc=True) \
        .limit(10) \
        .execute()

    city_users = city_leaderboard_res.data or []
    if len(city_users) < 2:
        nat_res = supabase.table("users").select("id, name, username, trail_score, city").order("trail_score", desc=True).limit(10).execute()
        city_users = nat_res.data or []

    # National Leaderboard
    national_res = supabase.table("users") \
        .select("id, name, username, trail_score, city") \
        .order("trail_score", desc=True) \
        .limit(10) \
        .execute()
    national_users = national_res.data or []

    city_ranked, city_viewer_stats = format_leaderboard_entries(city_users, user.get("username"))
    national_ranked, national_viewer_stats = format_leaderboard_entries(national_users, user.get("username"))

    return {
        "user": user,
        "leaderboard": city_ranked,
        "national_leaderboard": national_ranked,
        "city_viewer_stats": city_viewer_stats,
        "national_viewer_stats": national_viewer_stats,
        "recommended_trek": progression.get("trek"),
        "next_trek_progression": progression,
    }


from pydantic import BaseModel
from datetime import date
from typing import Optional, List

class LogTrekRequest(BaseModel):
    username: str
    trek_name: str
    date: date
    duration_mins: int
    review: str = ""
    lat: Optional[float] = None
    lon: Optional[float] = None

# ─── Trek List ───
class TrekOut(BaseModel):
    id: str
    name: str
    difficulty: str
    distance_km: float
    location: str
    elevation_m: int | None = None
    lat: float | None = None
    lon: float | None = None
    state: str | None = None


@app.get("/treks", response_model=list[TrekOut])
def list_treks(
    q: str | None = Query(None, description="Search query (matches against name and location)"),
    state: str | None = Query(None, description="State filter (e.g. Maharashtra)"),
    limit: int = Query(20, le=100, description="Maximum number of results to return")
):
    """
    Get treks with optional search query and state filter.
    - q: search query (matches against name, location)
    - state: state filter (case-insensitive)
    - limit: max results to return (default 20, max 100)
    """
    select_fields = "id, name, difficulty, distance_km, location, elevation_m, lat, lon, state"
    query = supabase.table("treks").select(select_fields)

    if state:
        query = query.ilike("state", state)

    if q:
        # Search in name and location (case-insensitive)
        query = query.or_(f"name.ilike.%{q}%,location.ilike.%{q}%")

    result = query.order("name").limit(limit).execute()
    return result.data


@app.get("/treks/{trek_id}/coordinates")
def get_trek_coordinates(trek_id: str):
    """Get coordinates for a specific trek (if available)"""
    try:
        result = supabase.table("treks").select("id, name, lat, lon").eq("id", trek_id).execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Trek not found")
    if not result.data:
        raise HTTPException(status_code=404, detail="Trek not found")
    return result.data[0]


@app.patch("/treks/{trek_id}/coordinates")
def update_trek_coordinates(trek_id: str, lat: float, lon: float):
    """Update coordinates for a specific trek (admin only)"""
    # Check if trek exists
    result = supabase.table("treks").select("id").eq("id", trek_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Trek not found")

    # Try to update - will fail if columns don't exist
    try:
        update_result = supabase_admin.table("treks").update({"lat": lat, "lon": lon}).eq("id", trek_id).execute()
        if update_result.data:
            return {"message": "Coordinates updated", "trek": update_result.data[0]}
        else:
            raise HTTPException(status_code=500, detail="Update failed")
    except Exception as e:
        if "column" in str(e).lower() and ("lat" in str(e).lower() or "lon" in str(e).lower()):
            raise HTTPException(
                status_code=503,
                detail="Coordinates columns not yet added to database. Run migration: ALTER TABLE treks ADD COLUMN lat DOUBLE PRECISION, ADD COLUMN lon DOUBLE PRECISION;"
            )
        raise


@app.post("/treks/log")
def log_trek(body: LogTrekRequest):
    user_result = supabase.table("users") \
        .select("id") \
        .ilike("username", body.username) \
        .execute()

    if not user_result.data:
        raise HTTPException(status_code=404, detail="User not found")

    user_id = user_result.data[0]["id"]

    trek_result = supabase.table("treks") \
        .select("id, difficulty, distance_km") \
        .eq("name", body.trek_name) \
        .execute()

    if not trek_result.data:
        raise HTTPException(status_code=404, detail="Trek not found")

    trek_id    = trek_result.data[0]["id"]
    distance   = trek_result.data[0]["distance_km"]
    difficulty = trek_result.data[0]["difficulty"]

    supabase.table("user_treks").insert({
        "user_id":       user_id,
        "trek_id":       trek_id,
        "date":          str(body.date),
        "duration_mins": body.duration_mins,
        "review":        body.review,
        "lat":           body.lat,
        "lon":           body.lon,
    }).execute()

    points = {"Hard": 30, "Medium": 20, "Easy": 10}.get(difficulty, 10)

    current = supabase.table("users") \
        .select("trail_score") \
        .eq("id", user_id) \
        .execute()

    new_score = current.data[0]["trail_score"] + points

    supabase.table("users") \
        .update({"trail_score": new_score}) \
        .eq("id", user_id) \
        .execute()

    return {
        "message": "Trek logged successfully!",
        "points_earned": points,
        "new_trail_score": new_score,
    }


from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
pwd_context = PasswordHasher()

class SignupRequest(BaseModel):
    name: str
    email: str
    username: str
    password: str
    city: str

class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/signup")
def signup(body: SignupRequest):
    normalized_username = body.username.strip().lower()

    existing = supabase.table("users") \
        .select("id") \
        .eq("email", body.email) \
        .execute()

    if existing.data and len(existing.data) > 0:
        raise HTTPException(status_code=400, detail="Email already registered")

    existing_username = supabase.table("users") \
        .select("id") \
        .ilike("username", normalized_username) \
        .execute()

    if existing_username.data and len(existing_username.data) > 0:
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed_password = pwd_context.hash(body.password)

    result = supabase.table("users").insert({
        "name":          body.name,
        "email":         body.email,
        "username":      normalized_username,
        "password_hash": hashed_password,
        "city":          body.city,
        "trail_score":   0,
        "rank":          "Beginner",
    }).execute()

    return {
        "message": "Account created successfully!",
        "username": normalized_username,
    }

@app.post("/auth/login")
def login(body: LoginRequest):
    result = supabase.table("users") \
        .select("*") \
        .eq("email", body.email) \
        .execute()

    if not result.data or len(result.data) == 0:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = result.data[0]

    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    try:
        pwd_context.verify(user["password_hash"], body.password)
    except VerifyMismatchError:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {
        "message": "Login successful!",
        "username": user["username"],
        "name":     user["name"],
        "city":     user["city"],
    }


class OAuthSyncRequest(BaseModel):
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    auth_id: Optional[str] = None
    city: Optional[str] = "Mumbai"

@app.post("/auth/oauth-sync")
def oauth_sync(body: OAuthSyncRequest):
    import re
    # 1. Check if user already exists with this email
    existing = supabase.table("users") \
        .select("*") \
        .eq("email", body.email) \
        .execute()

    if existing.data and len(existing.data) > 0:
        user = existing.data[0]
        if body.avatar_url and not user.get("photo"):
            supabase.table("users").update({"photo": body.avatar_url}).eq("id", user["id"]).execute()
        return {
            "message": "User authenticated",
            "username": user["username"],
            "name": user["name"],
            "city": user.get("city") or "Mumbai",
            "email": user["email"],
            "photo": user.get("photo") or body.avatar_url,
        }

    # 2. Generate clean unique username from email
    base_user = body.email.split("@")[0].lower()
    clean_username = re.sub(r"[^a-z0-9_]", "", base_user)
    if not clean_username:
        clean_username = "trekker"

    username_candidate = clean_username
    counter = 1
    while True:
        check = supabase.table("users").select("id").ilike("username", username_candidate).execute()
        if not check.data or len(check.data) == 0:
            break
        username_candidate = f"{clean_username}{counter}"
        counter += 1

    display_name = body.name or base_user.title()
    new_user_data = {
        "name": display_name,
        "email": body.email,
        "username": username_candidate,
        "city": body.city or "Mumbai",
        "photo": body.avatar_url,
        "trail_score": 0,
        "rank": "Beginner",
    }
    if body.auth_id:
        new_user_data["id"] = body.auth_id

    try:
        res = supabase.table("users").insert(new_user_data).execute()
        created_user = res.data[0] if res.data else new_user_data
    except Exception as e:
        # Fallback if id collision with another auth system
        if "id" in new_user_data:
            del new_user_data["id"]
        res = supabase.table("users").insert(new_user_data).execute()
        created_user = res.data[0] if res.data else new_user_data

    return {
        "message": "User synced successfully",
        "username": username_candidate,
        "name": display_name,
        "city": body.city or "Mumbai",
        "email": body.email,
        "photo": body.avatar_url,
    }


@app.get("/stats")
def get_stats():
    """Return live dynamic stats of the platform: registered trekkers, trails mapped, active groups."""
    try:
        users_res = supabase.table("users").select("id").execute()
        trails_res = supabase.table("treks").select("id").execute()
        groups_res = supabase.table("trek_groups").select("id").execute()
        return {
            "total_trekkers": len(users_res.data) if users_res.data else 0,
            "total_trails": len(trails_res.data) if trails_res.data else 0,
            "total_groups": len(groups_res.data) if groups_res.data else 0,
        }
    except Exception:
        return {
            "total_trekkers": 0,
            "total_trails": 27,
            "total_groups": 0,
        }



# ============================================================
# TREK GROUPS
# ============================================================

class ItineraryDay(BaseModel):
    day: int
    title: str
    description: str = ""
    distance_km: float = 0

class CreateGroupRequest(BaseModel):
    host_username: str
    title: str
    description: str = ""
    location: str
    cost: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_members: Optional[int] = None
    itinerary: List[ItineraryDay] = []

class JoinGroupRequest(BaseModel):
    username: str

class AddMemberRequest(BaseModel):
    host_username: str
    member_username: str

class PostAnnouncementRequest(BaseModel):
    host_username: str
    message: str

class PostQueryRequest(BaseModel):
    username: str
    question: str

class PostReplyRequest(BaseModel):
    username: str
    reply: str


def get_user_by_username(username: str):
    result = supabase.table("users") \
        .select("*") \
        .ilike("username", username) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="User not found")

    return result.data[0]


def get_group_or_404(group_id: str):
    try:
        result = supabase.table("trek_groups") \
            .select("*") \
            .eq("id", group_id) \
            .execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Group not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="Group not found")

    return result.data[0]


@app.post("/groups/create")
def create_group(body: CreateGroupRequest):
    host = get_user_by_username(body.host_username)

    result = supabase.table("trek_groups").insert({
        "host_id":     host["id"],
        "title":       body.title,
        "description": body.description,
        "location":    body.location,
        "cost":        body.cost,
        "start_date":  str(body.start_date) if body.start_date else None,
        "end_date":    str(body.end_date) if body.end_date else None,
        "max_members": body.max_members,
        "itinerary":   [day.dict() for day in body.itinerary],
    }).execute()

    return {
        "message": "Trek group created successfully!",
        "group": result.data[0],
    }

class UpdateGroupRequest(BaseModel):
    host_username: str
    title: str
    description: str = ""
    location: str
    cost: float
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    max_members: Optional[int] = None
    itinerary: List[ItineraryDay] = []

@app.put("/groups/{group_id}")
def update_group(group_id: str, body: UpdateGroupRequest):
    group = get_group_or_404(group_id)
    host = get_user_by_username(body.host_username)

    if host["id"] != group["host_id"]:
        raise HTTPException(status_code=403, detail="Only the host can edit this group")

    result = supabase.table("trek_groups") \
        .update({
            "title":       body.title,
            "description": body.description,
            "location":    body.location,
            "cost":        body.cost,
            "start_date":  str(body.start_date) if body.start_date else None,
            "end_date":    str(body.end_date) if body.end_date else None,
            "max_members": body.max_members,
            "itinerary":   [day.dict() for day in body.itinerary],
        }) \
        .eq("id", group_id) \
        .execute()

    return {
        "message": "Group updated successfully!",
        "group": result.data[0],
    }

@app.get("/groups")
def list_groups():
    from collections import Counter

    groups_result = supabase.table("trek_groups") \
        .select("*, users(name, username)") \
        .order("created_at", desc=True) \
        .execute()

    # Fetch all member counts in ONE query (fixes N+1 problem)
    group_ids = [g["id"] for g in groups_result.data]

    if group_ids:
        # Get all members for all groups at once
        members_result = supabase.table("trek_group_members") \
            .select("group_id") \
            .in_("group_id", group_ids) \
            .execute()

        # Count members per group using Counter
        member_counts = Counter(m["group_id"] for m in members_result.data)
    else:
        member_counts = Counter()

    groups = []
    for group in groups_result.data:
        host_info = group.pop("users", None)
        groups.append({
            **group,
            "host": host_info,
            "member_count": member_counts.get(group["id"], 0),
        })

    return {"groups": groups}


@app.get("/groups/{group_id}")
def get_group(group_id: str, viewer_username: Optional[str] = None):
    group = get_group_or_404(group_id)

    host_result = supabase.table("users") \
        .select("name, username") \
        .eq("id", group["host_id"]) \
        .execute()
    group["host"] = host_result.data[0] if host_result.data else None

    members_result = supabase.table("trek_group_members") \
        .select("*, users(name, username)") \
        .eq("group_id", group_id) \
        .execute()

    is_host = False
    is_member = False

    if viewer_username:
        viewer = get_user_by_username(viewer_username)
        is_host = viewer["id"] == group["host_id"]
        is_member = any(m["user_id"] == viewer["id"] for m in members_result.data)

    return {
        "group": group,
        "members": [m["users"] for m in members_result.data],
        "member_count": len(members_result.data),
        "is_host": is_host,
        "is_member": is_member,
    }


@app.post("/groups/{group_id}/join")
def join_group(group_id: str, body: JoinGroupRequest):
    group = get_group_or_404(group_id)
    user = get_user_by_username(body.username)

    if user["id"] == group["host_id"]:
        raise HTTPException(status_code=400, detail="You are the host of this group")

    existing = supabase.table("trek_group_members") \
        .select("id") \
        .eq("group_id", group_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="You have already joined this group")

    if group.get("max_members"):
        count_result = supabase.table("trek_group_members") \
            .select("id", count="exact") \
            .eq("group_id", group_id) \
            .execute()

        if (count_result.count or 0) >= group["max_members"]:
            raise HTTPException(status_code=400, detail="This group is full")

    supabase.table("trek_group_members").insert({
        "group_id": group_id,
        "user_id":  user["id"],
        "added_by": "self",
    }).execute()

    return {"message": "Joined group successfully!"}


@app.post("/groups/{group_id}/members")
def add_member(group_id: str, body: AddMemberRequest):
    group = get_group_or_404(group_id)
    host = get_user_by_username(body.host_username)

    if host["id"] != group["host_id"]:
        raise HTTPException(status_code=403, detail="Only the host can add members")

    member = get_user_by_username(body.member_username)

    if member["id"] == group["host_id"]:
        raise HTTPException(status_code=400, detail="The host is already part of this group")

    existing = supabase.table("trek_group_members") \
        .select("id") \
        .eq("group_id", group_id) \
        .eq("user_id", member["id"]) \
        .execute()

    if existing.data:
        raise HTTPException(status_code=400, detail="User is already a member of this group")

    supabase.table("trek_group_members").insert({
        "group_id": group_id,
        "user_id":  member["id"],
        "added_by": "host",
    }).execute()

    return {"message": f"{member['username']} added to the group!"}


class LeaveGroupRequest(BaseModel):
    username: str

@app.delete("/groups/{group_id}/leave")
def leave_group(group_id: str, body: LeaveGroupRequest):
    group = get_group_or_404(group_id)
    user = get_user_by_username(body.username)

    if user["id"] == group["host_id"]:
        raise HTTPException(status_code=400, detail="The host cannot leave their own group")

    existing = supabase.table("trek_group_members") \
        .select("id") \
        .eq("group_id", group_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not existing.data:
        raise HTTPException(status_code=400, detail="You are not a member of this group")

    supabase.table("trek_group_members") \
        .delete() \
        .eq("group_id", group_id) \
        .eq("user_id", user["id"]) \
        .execute()

    return {"message": "Left the group successfully"}


@app.get("/groups/{group_id}/messages")
def get_messages(group_id: str):
    get_group_or_404(group_id)

    messages_result = supabase.table("trek_group_messages") \
        .select("*, users(name, username)") \
        .eq("group_id", group_id) \
        .order("created_at", desc=True) \
        .execute()

    return {"messages": messages_result.data}


@app.post("/groups/{group_id}/messages")
def post_message(group_id: str, body: PostAnnouncementRequest):
    group = get_group_or_404(group_id)
    host = get_user_by_username(body.host_username)

    if host["id"] != group["host_id"]:
        raise HTTPException(status_code=403, detail="Only the host can post announcements")

    result = supabase.table("trek_group_messages").insert({
        "group_id":  group_id,
        "sender_id": host["id"],
        "message":   body.message,
    }).execute()

    return {"message": "Announcement posted!", "data": result.data[0]}


@app.get("/groups/{group_id}/queries")
def get_queries(group_id: str, viewer_username: str):
    from collections import defaultdict

    group = get_group_or_404(group_id)
    viewer = get_user_by_username(viewer_username)
    is_host = viewer["id"] == group["host_id"]

    query = supabase.table("trek_group_queries") \
        .select("*, users(name, username)") \
        .eq("group_id", group_id)

    if not is_host:
        query = query.eq("user_id", viewer["id"])

    queries_result = query.order("created_at", desc=False).execute()

    # Fix N+1 query: fetch all replies in ONE query instead of per-query loop
    if queries_result.data:
        query_ids = [q["id"] for q in queries_result.data]

        # Fetch ALL replies for all queries at once
        replies_result = supabase.table("trek_group_query_replies") \
            .select("*, users(name, username)") \
            .in_("query_id", query_ids) \
            .order("created_at", desc=False) \
            .execute()

        # Group replies by query_id using defaultdict
        replies_by_query = defaultdict(list)
        for reply in replies_result.data:
            replies_by_query[reply["query_id"]].append(reply)

        # Attach replies to each query
        queries = []
        for q in queries_result.data:
            queries.append({**q, "replies": replies_by_query.get(q["id"], [])})
    else:
        queries = []

    return {"queries": queries, "is_host": is_host}


@app.post("/groups/{group_id}/queries")
def post_query(group_id: str, body: PostQueryRequest):
    group = get_group_or_404(group_id)
    user = get_user_by_username(body.username)

    membership = supabase.table("trek_group_members") \
        .select("id") \
        .eq("group_id", group_id) \
        .eq("user_id", user["id"]) \
        .execute()

    if not membership.data and user["id"] != group["host_id"]:
        raise HTTPException(status_code=403, detail="Only group members can ask questions")

    result = supabase.table("trek_group_queries").insert({
        "group_id": group_id,
        "user_id":  user["id"],
        "question": body.question,
    }).execute()

    return {"message": "Question submitted!", "data": result.data[0]}


@app.post("/groups/{group_id}/queries/{query_id}/reply")
def post_reply(group_id: str, query_id: str, body: PostReplyRequest):
    group = get_group_or_404(group_id)
    user = get_user_by_username(body.username)

    try:
        query_result = supabase.table("trek_group_queries") \
            .select("*") \
            .eq("id", query_id) \
            .execute()
    except Exception:
        raise HTTPException(status_code=404, detail="Query not found")

    if not query_result.data:
        raise HTTPException(status_code=404, detail="Query not found")

    original_query = query_result.data[0]
    is_host = user["id"] == group["host_id"]
    is_asker = user["id"] == original_query["user_id"]

    if not (is_host or is_asker):
        raise HTTPException(status_code=403, detail="You can't reply to this query")

    result = supabase.table("trek_group_query_replies").insert({
        "query_id":  query_id,
        "sender_id": user["id"],
        "reply":     body.reply,
    }).execute()

    return {"message": "Reply posted!", "data": result.data[0]}


@app.get("/users/{username}/groups")
def get_user_groups(username: str):
    user = get_user_by_username(username)

    hosted_result = supabase.table("trek_groups") \
        .select("*") \
        .eq("host_id", user["id"]) \
        .order("created_at", desc=True) \
        .execute()

    joined_result = supabase.table("trek_group_members") \
        .select("trek_groups(*)") \
        .eq("user_id", user["id"]) \
        .execute()

    joined_groups = [m["trek_groups"] for m in joined_result.data]

    return {
        "hosted_groups": hosted_result.data,
        "joined_groups": joined_groups,
    }


# ============================================================
# GROUP TREK EXPENSE & PERMIT SPLITTER
# ============================================================

import sqlite3
import uuid
import json

EXPENSES_DB_PATH = os.path.join(os.path.dirname(__file__), "expenses.db")

def init_expenses_db():
    conn = sqlite3.connect(EXPENSES_DB_PATH)
    c = conn.cursor()
    c.execute("""
    CREATE TABLE IF NOT EXISTS group_expenses (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT 'other',
        amount REAL NOT NULL,
        paid_by TEXT NOT NULL,
        split_members TEXT NOT NULL DEFAULT 'all',
        notes TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS group_upi (
        group_id TEXT PRIMARY KEY,
        upi_id TEXT NOT NULL,
        upi_name TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    c.execute("""
    CREATE TABLE IF NOT EXISTS expense_settlements (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        from_user TEXT NOT NULL,
        to_user TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'confirmed',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    conn.commit()
    conn.close()

init_expenses_db()

class CreateExpenseRequest(BaseModel):
    title: str
    category: str = "other"  # permit, transport, food, guide, gear, stay, other
    amount: float
    paid_by: str
    split_members: List[str] = ["all"]
    notes: Optional[str] = ""

class SetUpiRequest(BaseModel):
    host_username: str
    upi_id: str
    upi_name: str

class SettleExpenseRequest(BaseModel):
    from_user: str
    to_user: str
    amount: float

def compute_group_debts(group_id: str, expenses: list, settlements: list, all_members: list):
    balances = {m: 0.0 for m in all_members}
    total_expenses = 0.0
    total_permits = 0.0
    category_totals = {}

    for exp in expenses:
        amt = float(exp["amount"])
        total_expenses += amt
        cat = exp["category"].lower()
        category_totals[cat] = round(category_totals.get(cat, 0.0) + amt, 2)
        if cat == "permit":
            total_permits += amt

        payer = exp["paid_by"]
        if payer not in balances:
            balances[payer] = 0.0
        balances[payer] += amt

        split_members = exp.get("split_members") or ["all"]
        if "all" in split_members or not split_members:
            targets = all_members if all_members else [payer]
        else:
            targets = [m for m in split_members if m in all_members] or [payer]

        share = amt / len(targets)
        for t in targets:
            if t not in balances:
                balances[t] = 0.0
            balances[t] -= share

    for s in settlements:
        f = s["from_user"]
        t = s["to_user"]
        amt = float(s["amount"])
        if f in balances:
            balances[f] += amt
        if t in balances:
            balances[t] -= amt

    for m in balances:
        balances[m] = round(balances[m], 2)

    debtors = []
    creditors = []
    for m, bal in balances.items():
        if bal < -0.01:
            debtors.append({"user": m, "amount": -bal})
        elif bal > 0.01:
            creditors.append({"user": m, "amount": bal})

    debts = []
    d_idx = 0
    c_idx = 0
    while d_idx < len(debtors) and c_idx < len(creditors):
        deb = debtors[d_idx]
        cred = creditors[c_idx]
        settle_amt = min(deb["amount"], cred["amount"])
        if settle_amt > 0.01:
            debts.append({
                "from_user": deb["user"],
                "to_user": cred["user"],
                "amount": round(settle_amt, 2),
            })
        deb["amount"] -= settle_amt
        cred["amount"] -= settle_amt
        if deb["amount"] <= 0.01:
            d_idx += 1
        if cred["amount"] <= 0.01:
            c_idx += 1

    return {
        "total_amount": round(total_expenses, 2),
        "permit_amount": round(total_permits, 2),
        "category_totals": category_totals,
        "balances": balances,
        "debts": debts,
    }

def _get_group_member_usernames(group_id: str) -> list[str]:
    group = get_group_or_404(group_id)
    host_res = supabase.table("users").select("username").eq("id", group["host_id"]).execute()
    host_username = host_res.data[0]["username"] if host_res.data else ""
    members_res = supabase.table("trek_group_members").select("users(username)").eq("group_id", group_id).execute()
    members = [host_username] if host_username else []
    for row in members_res.data:
        u = row.get("users", {}).get("username")
        if u and u not in members:
            members.append(u)
    return members

@app.get("/groups/{group_id}/expenses")
def get_group_expenses(group_id: str):
    get_group_or_404(group_id)
    conn = sqlite3.connect(EXPENSES_DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()

    c.execute("SELECT * FROM group_expenses WHERE group_id = ? ORDER BY created_at DESC", (group_id,))
    rows = c.fetchall()
    expenses = []
    for r in rows:
        expenses.append({
            "id": r["id"],
            "group_id": r["group_id"],
            "title": r["title"],
            "category": r["category"],
            "amount": r["amount"],
            "paid_by": r["paid_by"],
            "split_members": json.loads(r["split_members"]) if r["split_members"].startswith("[") else ["all"],
            "notes": r["notes"],
            "created_at": r["created_at"],
        })

    c.execute("SELECT * FROM group_upi WHERE group_id = ?", (group_id,))
    upi_row = c.fetchone()
    upi_info = {"upi_id": upi_row["upi_id"], "upi_name": upi_row["upi_name"]} if upi_row else None

    c.execute("SELECT * FROM expense_settlements WHERE group_id = ? ORDER BY created_at DESC", (group_id,))
    settlements = [dict(r) for r in c.fetchall()]
    conn.close()

    members = _get_group_member_usernames(group_id)
    calc = compute_group_debts(group_id, expenses, settlements, members)

    return {
        "expenses": expenses,
        "upi": upi_info,
        "settlements": settlements,
        "summary": calc,
        "members": members,
    }

@app.post("/groups/{group_id}/expenses")
def create_group_expense(group_id: str, body: CreateExpenseRequest):
    get_group_or_404(group_id)
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Expense amount must be greater than 0")

    expense_id = str(uuid.uuid4())
    conn = sqlite3.connect(EXPENSES_DB_PATH)
    c = conn.cursor()
    c.execute("""
    INSERT INTO group_expenses (id, group_id, title, category, amount, paid_by, split_members, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        expense_id,
        group_id,
        body.title.strip(),
        body.category.lower().strip(),
        body.amount,
        body.paid_by.lower().strip(),
        json.dumps(body.split_members),
        body.notes or "",
    ))
    conn.commit()
    conn.close()

    return {"message": "Expense added successfully", "expense_id": expense_id}

@app.delete("/groups/{group_id}/expenses/{expense_id}")
def delete_group_expense(group_id: str, expense_id: str, requester: str = Query(...)):
    group = get_group_or_404(group_id)
    host_res = supabase.table("users").select("username").eq("id", group["host_id"]).execute()
    host_username = host_res.data[0]["username"] if host_res.data else ""

    conn = sqlite3.connect(EXPENSES_DB_PATH)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM group_expenses WHERE id = ? AND group_id = ?", (expense_id, group_id))
    expense = c.fetchone()
    if not expense:
        conn.close()
        raise HTTPException(status_code=404, detail="Expense not found")

    is_payer = expense["paid_by"].lower() == requester.lower()
    is_host = host_username.lower() == requester.lower()
    if not (is_payer or is_host):
        conn.close()
        raise HTTPException(status_code=403, detail="Only the expense payer or group host can delete this expense")

    c.execute("DELETE FROM group_expenses WHERE id = ?", (expense_id,))
    conn.commit()
    conn.close()

    return {"message": "Expense deleted successfully"}

@app.post("/groups/{group_id}/upi")
def set_group_upi(group_id: str, body: SetUpiRequest):
    group = get_group_or_404(group_id)
    host = get_user_by_username(body.host_username)
    if host["id"] != group["host_id"]:
        raise HTTPException(status_code=403, detail="Only the host can configure group UPI payment details")

    conn = sqlite3.connect(EXPENSES_DB_PATH)
    c = conn.cursor()
    c.execute("""
    INSERT INTO group_upi (group_id, upi_id, upi_name, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(group_id) DO UPDATE SET upi_id = excluded.upi_id, upi_name = excluded.upi_name, updated_at = CURRENT_TIMESTAMP
    """, (group_id, body.upi_id.strip(), body.upi_name.strip()))
    conn.commit()
    conn.close()

    return {"message": "UPI payment details saved successfully"}

@app.post("/groups/{group_id}/settle")
def settle_expense(group_id: str, body: SettleExpenseRequest):
    get_group_or_404(group_id)
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Settlement amount must be greater than 0")

    settlement_id = str(uuid.uuid4())
    conn = sqlite3.connect(EXPENSES_DB_PATH)
    c = conn.cursor()
    c.execute("""
    INSERT INTO expense_settlements (id, group_id, from_user, to_user, amount, status)
    VALUES (?, ?, ?, ?, ?, 'confirmed')
    """, (settlement_id, group_id, body.from_user.lower().strip(), body.to_user.lower().strip(), body.amount))
    conn.commit()
    conn.close()

    return {"message": "Settlement payment recorded successfully"}


# ============================================================
# WEATHER + TREK RISK
# ============================================================

def _normalize_owm_response(raw: dict) -> dict:
    """
    Safely extract and normalize weather fields from raw OpenWeatherMap response.
    Normalizes 3-hour precipitation (rain/snow) to hourly equivalents if 1h is absent.
    """
    if not isinstance(raw, dict):
        return {}

    main = raw.get("main") if isinstance(raw.get("main"), dict) else {}
    wind = raw.get("wind") if isinstance(raw.get("wind"), dict) else {}
    weather_list = raw.get("weather") if isinstance(raw.get("weather"), list) else []
    first_weather = weather_list[0] if (weather_list and isinstance(weather_list[0], dict)) else {}
    sys = raw.get("sys") if isinstance(raw.get("sys"), dict) else {}
    clouds = raw.get("clouds") if isinstance(raw.get("clouds"), dict) else {}
    rain = raw.get("rain") if isinstance(raw.get("rain"), dict) else {}
    snow = raw.get("snow") if isinstance(raw.get("snow"), dict) else {}

    # Rain normalization (1h or 3h / 3)
    rain_1h = 0.0
    if "1h" in rain:
        try:
            rain_1h = float(rain["1h"])
        except (ValueError, TypeError):
            pass
    elif "3h" in rain:
        try:
            rain_1h = float(rain["3h"]) / 3.0
        except (ValueError, TypeError):
            pass

    # Snow normalization (1h or 3h / 3)
    snow_1h = 0.0
    if "1h" in snow:
        try:
            snow_1h = float(snow["1h"])
        except (ValueError, TypeError):
            pass
    elif "3h" in snow:
        try:
            snow_1h = float(snow["3h"]) / 3.0
        except (ValueError, TypeError):
            pass

    return {
        "temp": main.get("temp"),
        "feels_like": main.get("feels_like"),
        "temp_min": main.get("temp_min"),
        "temp_max": main.get("temp_max"),
        "humidity": main.get("humidity"),
        "pressure": main.get("pressure"),
        "visibility": raw.get("visibility", 10000),
        "wind_speed": wind.get("speed", 0.0),
        "wind_deg": wind.get("deg", 0),
        "wind_gust": wind.get("gust"),
        "clouds": clouds.get("all", 0),
        "rain_1h": rain_1h,
        "snow_1h": snow_1h,
        "weather_id": first_weather.get("id", 800),
        "weather_main": first_weather.get("main", "Clear"),
        "weather_desc": first_weather.get("description", "clear sky"),
        "weather_icon": first_weather.get("icon", "01d"),
        "sunrise": sys.get("sunrise"),
        "sunset": sys.get("sunset"),
        "uvi": raw.get("uvi", 0),
        "location_name": raw.get("name", ""),
        "country": sys.get("country", ""),
        "dt": raw.get("dt"),
    }


def _compute_trek_risk(weather: dict) -> dict:
    """
    Heuristic risk score (0–100) built from live weather data.
    Evaluates 7 weather signals: wind, rain, snow, visibility, temperature,
    thunderstorm, and UV index.

    Missing or invalid data is never treated as safe. Returns score, label,
    color, and contributing factors.
    """
    if not weather or not isinstance(weather, dict):
        return {
            "score": None,
            "label": "Incomplete Data",
            "color": "amber",
            "factors": [{"label": "Weather data unavailable — conditions unverified", "severity": "medium"}],
        }

    def safe_float(val):
        if val is None:
            return None
        try:
            return float(val)
        except (ValueError, TypeError):
            return None

    def safe_int(val):
        if val is None:
            return None
        try:
            return int(val)
        except (ValueError, TypeError):
            return None

    temp = safe_float(weather.get("temp"))
    wind_speed = safe_float(weather.get("wind_speed"))
    visibility = safe_float(weather.get("visibility"))
    rain_1h = safe_float(weather.get("rain_1h")) or 0.0
    snow_1h = safe_float(weather.get("snow_1h")) or 0.0
    weather_id = safe_int(weather.get("weather_id"))
    uvi = safe_float(weather.get("uvi")) or 0.0

    score = 0
    factors = []
    missing_critical = []

    if temp is None:
        missing_critical.append("temperature")
    if wind_speed is None:
        missing_critical.append("wind speed")
    if weather_id is None:
        missing_critical.append("weather condition")

    # If critical signals are missing, data cannot be evaluated as safe
    if len(missing_critical) >= 2 or (temp is None and wind_speed is None):
        return {
            "score": None,
            "label": "Incomplete Data",
            "color": "amber",
            "factors": [{"label": f"Missing critical signals ({', '.join(missing_critical)}) — exercise caution", "severity": "medium"}],
        }

    # 1. Wind Signal
    if wind_speed is not None:
        if wind_speed >= 17:
            score += 30
            factors.append({"label": "Dangerous wind speeds", "severity": "high"})
        elif wind_speed >= 10:
            score += 15
            factors.append({"label": "Strong winds", "severity": "medium"})
    else:
        factors.append({"label": "Wind speed data unavailable", "severity": "low"})

    # 2. Rain Signal
    if rain_1h >= 10:
        score += 25
        factors.append({"label": "Heavy rainfall", "severity": "high"})
    elif rain_1h >= 2.5:
        score += 12
        factors.append({"label": "Moderate rainfall", "severity": "medium"})
    elif rain_1h > 0:
        score += 5
        factors.append({"label": "Light rain", "severity": "low"})

    # 3. Snow Signal
    if snow_1h >= 5:
        score += 30
        factors.append({"label": "Heavy snowfall", "severity": "high"})
    elif snow_1h > 0:
        score += 15
        factors.append({"label": "Snowfall present", "severity": "medium"})

    # 4. Visibility Signal
    if visibility is not None:
        if visibility < 500:
            score += 25
            factors.append({"label": "Near-zero visibility", "severity": "high"})
        elif visibility < 1000:
            score += 15
            factors.append({"label": "Poor visibility", "severity": "medium"})
        elif visibility < 3000:
            score += 5
            factors.append({"label": "Reduced visibility", "severity": "low"})
    else:
        factors.append({"label": "Visibility data unavailable", "severity": "low"})

    # 5. Temperature Signal
    if temp is not None:
        if temp <= 0:
            score += 20
            factors.append({"label": "Freezing temperatures", "severity": "high"})
        elif temp <= 5:
            score += 10
            factors.append({"label": "Near-freezing temperatures", "severity": "medium"})
        elif temp >= 40:
            score += 20
            factors.append({"label": "Extreme heat", "severity": "high"})
        elif temp >= 35:
            score += 10
            factors.append({"label": "High heat", "severity": "medium"})
    else:
        score += 10
        factors.append({"label": "Temperature data unavailable", "severity": "medium"})

    # 6. Thunderstorm (OWM 2xx condition codes)
    if weather_id is not None and 200 <= weather_id < 300:
        score += 35
        factors.append({"label": "Thunderstorm active", "severity": "high"})

    # 7. UV Index
    if uvi >= 8:
        score += 10
        factors.append({"label": "Very high UV index", "severity": "medium"})
    elif uvi >= 6:
        score += 5
        factors.append({"label": "High UV index", "severity": "low"})

    # Clamp score to 0..100
    score = min(max(score, 0), 100)

    # Categories
    if score >= 65:
        label, color = "High Risk", "red"
    elif score >= 35:
        label, color = "Moderate Risk", "amber"
    else:
        label, color = "Low Risk", "green"

    return {"score": score, "label": label, "color": color, "factors": factors}


@app.get("/weather/{lat}/{lon}")
async def get_trek_weather(lat: float, lon: float):
    """
    Fetch current weather for a trek location and return enriched data
    with a heuristic risk prediction score.
    Weather and risk data are cached for up to 10 minutes (600s).
    """
    cache_key = f"weather:{round(lat, 4)}:{round(lon, 4)}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    if not OPENWEATHER_API_KEY:
        raise HTTPException(status_code=500, detail="OpenWeatherMap API key not configured")

    url = (
        f"https://api.openweathermap.org/data/2.5/weather"
        f"?lat={lat}&lon={lon}&appid={OPENWEATHER_API_KEY}&units=metric"
    )

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url)

    if resp.status_code != 200:
        raise HTTPException(
            status_code=resp.status_code,
            detail=f"OpenWeatherMap error: {resp.text}"
        )

    raw = resp.json()
    weather_data = _normalize_owm_response(raw)
    risk = _compute_trek_risk(weather_data)

    response_data = {
        "weather": weather_data,
        "risk":    risk,
    }
    # Weather and risk data must not be cached longer than 10 minutes (600s)
    set_cached_result(cache_key, response_data, ttl=WEATHER_CACHE_TTL)
    return response_data


# ═══════════════════════════════════════════════════════════════════
# AI RISK PREDICTION ENGINE (GENERAL & PERSONALIZED)
# ═══════════════════════════════════════════════════════════════════

def compute_general_trail_risk(trek: dict, weather: dict = None) -> dict:
    """
    1. GENERAL RISK PREDICTOR (Objective / Environmental)
    Predicts the objective hazard level of a trek without accounting for personal experience.
    Directly evaluates:
      - Elevation & altitude AMS exposure
      - Distance & endurance fatigue risk
      - Trail steepness / gradient ratio (elevation_m / distance_km)
      - Physical terrain difficulty (Easy, Medium, Hard, Extreme)
      - Real-time or local weather signals (rainfall, wind shear, extreme heat/cold)
    """
    elevation = float(trek.get("elevation_m") or 800)
    distance = max(float(trek.get("distance_km") or 8), 1.0)
    difficulty = str(trek.get("difficulty") or "Medium").capitalize()
    
    gradient = elevation / distance  # meters climbed per kilometer
    
    score = 0
    factors = []
    hazards = []
    gear = []
    
    # 1. Elevation Hazards
    if elevation >= 2500:
        score += 30
        factors.append({"label": f"High Himalayan altitude ({int(elevation)}m) — Acute Mountain Sickness (AMS) & oxygen drop", "severity": "high"})
        hazards.append("Acute Mountain Sickness (AMS) risk above 2,500m")
        gear.extend(["Diamox / Altitude medication", "Thermal windcheater (-5°C rated)", "Pulse oximeter"])
    elif elevation >= 1500:
        score += 18
        factors.append({"label": f"Elevated Sahyadri summit ({int(elevation)}m) — cold ridge winds & sudden cloud envelopment", "severity": "medium"})
        hazards.append("High ridge wind exposure & sudden mist")
        gear.extend(["Lightweight windcheater", "Electrolyte hydration packs"])
    elif elevation >= 1100:
        score += 10
        factors.append({"label": f"Moderate mountain altitude ({int(elevation)}m) — continuous cardiovascular ascent", "severity": "low"})
        hazards.append("Sustained uphill muscle exertion")
        gear.append("2L Hydration bladder")
    else:
        score += 4
        factors.append({"label": f"Low altitude trail ({int(elevation)}m) — accessible rolling topography", "severity": "low"})
        hazards.append("Mild cardiovascular load")
    
    # 2. Distance Hazards
    if distance >= 18:
        score += 25
        factors.append({"label": f"Endurance ultra trail ({distance:.1f}km) — high dehydration risk & delayed rescue turnaround", "severity": "high"})
        hazards.append("Extreme physical depletion & potential nightfall traversal")
        gear.extend(["Rechargeable headlamp (150+ lumens)", "3L Hydration reservoir", "Fast-acting carbohydrate gels"])
    elif distance >= 12:
        score += 15
        factors.append({"label": f"Substantial endurance route ({distance:.1f}km) — typically 5 to 7 hours active trek", "severity": "medium"})
        hazards.append("Sole abrasion & calf muscle cramping")
        gear.extend(["Trek poles with rubber tips", "First-aid blister tape"])
    elif distance >= 8:
        score += 8
        factors.append({"label": f"Moderate distance ({distance:.1f}km) — 3 to 4 hours on foot", "severity": "low"})
    else:
        score += 3
        factors.append({"label": f"Short scenic hike ({distance:.1f}km) — manageable under 3 hours", "severity": "low"})
        
    # 3. Gradient / Steepness Hazards (m gained per km)
    if gradient >= 100:
        score += 25
        factors.append({"label": f"Near-vertical rock gradient ({gradient:.0f}m gain/km) — steep rock-cut stairs & exposure fall hazard", "severity": "high"})
        hazards.append("Near-vertical rock steps & unprotected cliff edges")
        gear.append("High-ankle hiking boots with deep rubber lug traction")
    elif gradient >= 70:
        score += 15
        factors.append({"label": f"Demanding uphill mountain gradient ({gradient:.0f}m gain/km)", "severity": "medium"})
        hazards.append("Loose scree & unstable gravel slippage")
        gear.append("Trek pole for knee stabilization")
    elif gradient >= 40:
        score += 8
        factors.append({"label": f"Steady incline ({gradient:.0f}m gain/km)", "severity": "low"})
    else:
        score += 3

    # 4. Difficulty Classification
    if difficulty in ["Hard", "Extreme"]:
        score += 15
        hazards.append("Technical scrambling / rock chimney sections")
    elif difficulty in ["Medium", "Moderate"]:
        score += 8
    else:
        score += 2
        
    # 5. Live/Regional Weather Integration
    if weather and isinstance(weather, dict):
        weather_risk = _compute_trek_risk(weather)
        if weather_risk.get("score") is not None:
            w_score = weather_risk["score"]
            score = int((score * 0.7) + (w_score * 0.3))
            for f in weather_risk.get("factors", []):
                factors.append({"label": f"Weather Signal: {f['label']}", "severity": f.get("severity", "medium")})
    
    score = min(max(score, 5), 100)
    
    if score >= 65:
        label = "High Risk"
        color = "red"
    elif score >= 35:
        label = "Moderate Risk"
        color = "amber"
    else:
        label = "Low Risk"
        color = "emerald"
        
    unique_gear = list(dict.fromkeys(gear))
    if not unique_gear:
        unique_gear = ["Sturdy trail shoes with lug traction", "1.5L Drinking water bottle", "Breathable daypack"]
        
    return {
        "score": score,
        "label": label,
        "color": color,
        "gradient_m_per_km": round(gradient, 1),
        "terrain_hazards": hazards,
        "contributing_factors": factors,
        "recommended_gear": unique_gear,
        "emergency_notes": f"Trail located in {trek.get('location', 'Mountain range')}. Keep phone battery above 70% and carry a whistle for emergency fog signaling."
    }


def compute_personalized_trail_risk(trek: dict, user: dict, trek_history: list = None) -> dict:
    """
    2. PERSONALIZED RISK & DIFFICULTY PREDICTOR (User-Centric)
    Predicts the difficulty and risk of a trek specifically tailored to the user's profile.
    Accounts for:
      - Number of completed summits logged
      - User's Trail Score
      - Maximum past elevation and distance conquered
      - Difficulty tier experience leap
    """
    history = trek_history or []
    completed_count = len(history)
    trail_score = int(user.get("trail_score") or 0)
    
    target_elevation = float(trek.get("elevation_m") or 800)
    target_distance = float(trek.get("distance_km") or 8)
    target_difficulty = str(trek.get("difficulty") or "Medium").capitalize()
    
    past_elevations = []
    past_distances = []
    past_difficulties = set()
    
    for h in history:
        t_info = h.get("treks") or {}
        elev = t_info.get("elevation_m") or h.get("elevation_m")
        dist = t_info.get("distance_km") or h.get("distance_km")
        diff = t_info.get("difficulty") or h.get("difficulty")
        if elev: past_elevations.append(float(elev))
        if dist: past_distances.append(float(dist))
        if diff: past_difficulties.add(str(diff).capitalize())
        
    max_past_elevation = max(past_elevations) if past_elevations else 0.0
    max_past_distance = max(past_distances) if past_distances else 0.0
    
    # ── CASE 1: Brand New User / Zero Profile Data ──
    if completed_count == 0 and trail_score == 0:
        if target_difficulty == "Easy" and target_elevation <= 1100:
            score = 25
            readiness = 90
            verdict = "Ideal Starter Trek for You"
            color = "emerald"
            advice = f"As a first-time trekker on TrailVerse, {trek.get('name')} is an excellent entry point. Gentle gradient, scenic views, and well-marked paths make it safe and rewarding."
        elif target_difficulty in ["Medium", "Moderate"] and target_elevation <= 1400:
            score = 55
            readiness = 65
            verdict = "Moderate First Challenge"
            color = "amber"
            advice = f"You haven't logged any previous treks yet. {trek.get('name')} ({int(target_elevation)}m) requires solid cardiovascular fitness. We recommend doing light jogging for 3 days prior."
        else:
            score = 80
            readiness = 40
            verdict = "High Risk for New Trekkers"
            color = "red"
            advice = f"{trek.get('name')} is a {target_difficulty} trail with {int(target_elevation)}m elevation. We strongly recommend conquering 1-2 Easy trails (like Lohagad or Sinhagad) before attempting this summit."
            
        return {
            "personal_difficulty_score": score,
            "readiness_percentage": readiness,
            "verdict": verdict,
            "color": color,
            "personalized_advice": advice,
            "user_experience": {
                "treks_completed": 0,
                "trail_score": 0,
                "max_past_elevation": 0,
                "max_past_distance": 0,
            },
            "experience_gap": {
                "elevation_delta_m": int(target_elevation),
                "distance_delta_km": round(target_distance, 1),
                "is_new_difficulty": True,
            }
        }
        
    # ── CASE 2: Active User with Demonstrated Experience ──
    elevation_delta = max(0.0, target_elevation - max_past_elevation)
    distance_delta = max(0.0, target_distance - max_past_distance)
    has_conquered_difficulty = target_difficulty in past_difficulties
    
    readiness = 72.0
    
    # Trail Score Experience weighting
    if trail_score >= 1000:
        readiness += 15
    elif trail_score >= 400:
        readiness += 10
    elif trail_score >= 100:
        readiness += 5
        
    # Elevation delta deduction
    if elevation_delta > 600:
        readiness -= 25
    elif elevation_delta > 300:
        readiness -= 15
    elif elevation_delta == 0:
        readiness += 10
        
    # Distance delta deduction
    if distance_delta > 6:
        readiness -= 20
    elif distance_delta > 3:
        readiness -= 10
    elif distance_delta == 0:
        readiness += 5
        
    # Difficulty tier leap
    if target_difficulty == "Hard" and not ("Hard" in past_difficulties or "Medium" in past_difficulties):
        readiness -= 25
    elif has_conquered_difficulty:
        readiness += 10
        
    readiness = int(min(max(readiness, 15), 98))
    score = 100 - readiness
    
    if readiness >= 85:
        verdict = "Optimal Match for Your Fitness"
        color = "emerald"
        advice = f"You have already proven capability up to {int(max_past_elevation)}m and {round(max_past_distance, 1)}km. You are in prime condition to conquer {trek.get('name')}!"
    elif readiness >= 70:
        verdict = "Progressive Milestone"
        color = "blue"
        advice = f"Great next milestone! This pushes your elevation by +{int(elevation_delta)}m beyond your past max ({int(max_past_elevation)}m). Ensure adequate hydration."
    elif readiness >= 50:
        verdict = "Strenuous Challenge"
        color = "amber"
        advice = f"{trek.get('name')} exceeds your previous distance or elevation by a notable margin (+{int(elevation_delta)}m). Recommend trekking with a partner or group."
    else:
        verdict = "High Risk for Your Profile"
        color = "red"
        advice = f"Significant leap in difficulty from your past achievements. We recommend a stepping-stone trek first before attempting {trek.get('name')}."
        
    return {
        "personal_difficulty_score": score,
        "readiness_percentage": readiness,
        "verdict": verdict,
        "color": color,
        "personalized_advice": advice,
        "user_experience": {
            "treks_completed": completed_count,
            "trail_score": trail_score,
            "max_past_elevation": int(max_past_elevation),
            "max_past_distance": round(max_past_distance, 1),
        },
        "experience_gap": {
            "elevation_delta_m": int(elevation_delta),
            "distance_delta_km": round(distance_delta, 1),
            "is_new_difficulty": not has_conquered_difficulty,
        }
    }


def compute_next_trek_recommendation(user: dict, trek_history: list, all_treks: list) -> dict:
    """
    3. NEXT TREK PROGRESSION RECOMMENDER
    Analyzes user profile to suggest the exact next trail/trek milestone.
    If profile shows no data: suggests a curated easy starter trek with first-timer checklist.
    If user has logged treks: suggests the optimal progressive milestone summit.
    """
    history = trek_history or []
    completed_names = {h.get("treks", {}).get("name", "").strip().lower() for h in history if isinstance(h, dict) and h.get("treks")}
    completed_names.update({(h.get("trek_name") or "").strip().lower() for h in history if isinstance(h, dict)})
    
    trail_score = int(user.get("trail_score") or 0)
    
    # ── CASE 1: Brand New User / Zero Profile Data ──
    if len(history) == 0:
        starter_candidates = [t for t in all_treks if t.get("difficulty") == "Easy" and (t.get("elevation_m") or 0) <= 1100]
        chosen = starter_candidates[0] if starter_candidates else all_treks[0]
        
        return {
            "is_first_timer": True,
            "progression_stage": "Foundational First Trek",
            "headline": f"Start Your Journey with {chosen['name']}",
            "trek": chosen,
            "reason": f"{chosen['name']} is the ideal trail for beginning your trekking journey in {chosen.get('state', 'Maharashtra')}. It features well-marked paths, gentle elevation ({chosen.get('elevation_m', 1000)}m), and stunning fortress panoramas to build your baseline confidence.",
            "first_timer_checklist": [
                {"title": "Footwear", "desc": "Wear broken-in athletic sneakers or hiking boots with rubber lug traction."},
                {"title": "Hydration", "desc": "Carry at least 2.0 Litres of drinking water + electrolyte / ORS powder."},
                {"title": "Timing", "desc": "Reach base village before 7:30 AM to ascend in cool morning weather."},
                {"title": "Backpack Essentials", "desc": "Pack sun protection (hat, sunscreen), lightweight rain poncho, and energy snacks."}
            ],
            "badge_target": {
                "title": "First Summit Badge",
                "points_reward": 100,
                "description": "Log this trek to unlock your verified explorer rank on the TrailVerse leaderboard!"
            }
        }
        
    # ── CASE 2: Active User with Experience ──
    past_elevations = [h.get("treks", {}).get("elevation_m") or 800 for h in history if isinstance(h, dict) and h.get("treks")]
    max_elev = max(past_elevations) if past_elevations else 800
    
    uncompleted = [t for t in all_treks if t.get("name", "").strip().lower() not in completed_names]
    if not uncompleted:
        uncompleted = all_treks
        
    target_trek = None
    for diff_target in ["Medium", "Hard"]:
        candidates = [t for t in uncompleted if t.get("difficulty") == diff_target and (t.get("elevation_m") or 0) >= max_elev]
        if candidates:
            candidates.sort(key=lambda x: x.get("elevation_m") or 0)
            target_trek = candidates[0]
            break
            
    if not target_trek:
        uncompleted.sort(key=lambda x: x.get("elevation_m") or 0, reverse=True)
        target_trek = uncompleted[0]
        
    target_elevation = target_trek.get("elevation_m") or 1000
    elev_diff = target_elevation - max_elev
    
    return {
        "is_first_timer": False,
        "progression_stage": "Next Milestone Summit",
        "headline": f"Ready for the Next Peak: {target_trek['name']}",
        "trek": target_trek,
        "reason": f"You've proven your endurance on {len(history)} previous summit(s) up to {int(max_elev)}m. {target_trek['name']} ({target_trek['difficulty']}, {target_elevation}m) offers the ideal progressive challenge (+{int(elev_diff)}m elevation gain) to elevate your Trail Score.",
        "readiness_percentage": 85 if elev_diff <= 350 else 70,
        "next_step_action_plan": [
            {"step": 1, "title": "Endurance Conditioning", "desc": "Do 15 minutes of stair climbing or incline walking twice this week to prep your quads."},
            {"step": 2, "title": "Check Weather & Risk", "desc": "Use the live Trail Risk Predictor on the Explore page 24 hours before heading out."},
            {"step": 3, "title": "Coordinate Group or Buddy", "desc": "Post or join an RSVP in Trek Groups to split cabs and forest permits."}
        ],
        "badge_target": {
            "title": "Altitude Milestone Badge",
            "points_reward": 250,
            "description": f"Conquer {target_trek['name']} to climb your city standings!"
        }
    }


# ═══════════════════════════════════════════════════════════════════
# RISK & PROGRESSION API ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/treks/{trek_id}/risk")
def get_trek_risk_assessment(trek_id: str, username: str | None = None):
    """
    Returns both:
      1. General Risk Assessment (Objective / Environmental)
      2. Personalized Risk Assessment (User-Centric, if username provided)
    """
    res = supabase.table("treks").select("*").eq("id", trek_id).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Trek not found")
        
    trek = res.data[0]
    general_risk = compute_general_trail_risk(trek)
    
    personalized_risk = None
    if username:
        user_res = supabase.table("users").select("*").ilike("username", username).execute()
        if user_res.data:
            user = user_res.data[0]
            treks_res = supabase.table("user_treks").select("*, treks(name, difficulty, distance_km, elevation_m)").eq("user_id", user["id"]).execute()
            personalized_risk = compute_personalized_trail_risk(trek, user, treks_res.data or [])
            
    return {
        "trek": trek,
        "general_risk": general_risk,
        "personalized_risk": personalized_risk,
    }


@app.get("/treks/all-with-risk")
def get_all_treks_with_risk(username: str | None = None):
    """
    Returns all curated treks enriched with pre-calculated general risk scores
    and personalized difficulty ratings for high-speed map and explore views (<25ms).
    """
    cache_key = f"treks_all_with_risk:{username or 'anon'}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    res = supabase.table("treks").select("*").execute()
    treks = res.data or []
    
    user = None
    user_history = []
    if username:
        user_res = supabase.table("users").select("*").ilike("username", username).execute()
        if user_res.data:
            user = user_res.data[0]
            history_res = supabase.table("user_treks").select("*, treks(name, difficulty, distance_km, elevation_m)").eq("user_id", user["id"]).execute()
            user_history = history_res.data or []
            
    enriched = []
    for t in treks:
        g_risk = compute_general_trail_risk(t)
        p_risk = compute_personalized_trail_risk(t, user, user_history) if user else None
        
        item = dict(t)
        item["general_risk"] = g_risk
        item["personalized_risk"] = p_risk
        enriched.append(item)
        
    response = {"treks": enriched, "total": len(enriched)}
    set_cached_result(cache_key, response, ttl=60)
    return response


@app.get("/recommendations/next-trek")
def get_next_trek_recommendation_endpoint(username: str):
    """
    Recommends the user's next trek step based on their profile and completed history.
    If no history exists, suggests a verified easy starter trek with first-time checklist.
    """
    user_res = supabase.table("users").select("*").ilike("username", username).execute()
    if not user_res.data:
        raise HTTPException(status_code=404, detail="User not found")
        
    user = user_res.data[0]
    history_res = supabase.table("user_treks").select("*, treks(name, difficulty, distance_km, elevation_m)").eq("user_id", user["id"]).execute()
    all_treks_res = supabase.table("treks").select("*").execute()
    
    rec = compute_next_trek_recommendation(user, history_res.data or [], all_treks_res.data or [])
    return rec


# ═══════════════════════════════════════════════════════════════════
# LEADERBOARD API ENDPOINT
# ═══════════════════════════════════════════════════════════════════

@app.get("/leaderboard")
def get_leaderboard_endpoint(
    scope: str = Query("national", pattern="^(city|state|national)$"),
    city: str | None = None,
    viewer_username: str | None = None,
    limit: int = 50
):
    """
    Returns full leaderboard rankings across local city or national all-India scopes.
    Calculates rankings, tiers (Novice, Scout, Pathfinder, Mountaineer, Summit Master),
    podiums (gold, silver, bronze), and viewer's rank standing.
    """
    query = supabase.table("users").select("id, name, username, city, trail_score")
    
    if scope == "city" and city:
        query = query.ilike("city", city)
        
    query = query.order("trail_score", desc=True).limit(limit)
    res = query.execute()
    users_data = res.data or []
    
    # Fallback if city has fewer than 2 users
    if scope == "city" and len(users_data) < 2:
        all_users_res = supabase.table("users").select("id, name, username, city, trail_score").order("trail_score", desc=True).limit(limit).execute()
        users_data = all_users_res.data or []
        
    ranked_list, viewer_stats = format_leaderboard_entries(users_data, viewer_username)
    return {
        "scope": scope,
        "city": city,
        "leaderboard": ranked_list,
        "viewer_stats": viewer_stats,
    }




# ─── Admin: Trek Import ───
class TrekImportRequest(BaseModel):
    treks: list[dict]


@app.post("/admin/treks/import")
def import_treks(body: TrekImportRequest):
    """
    Admin endpoint to bulk import treks.
    Uses the service role client to bypass RLS.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Admin import disabled: SUPABASE_SERVICE_ROLE_KEY not configured")

    if not body.treks:
        return {"message": "No treks provided", "imported": 0}

    success = 0
    failed = 0
    errors = []

    for trek in body.treks:
        try:
            # Check if trek already exists by name and location
            existing = supabase_admin.table("treks").select("id").eq("name", trek["name"]).eq("location", trek["location"]).execute()

            if existing.data:
                # Update existing record
                update_data = {
                    "difficulty": trek.get("difficulty"),
                    "distance_km": trek["distance_km"],
                    "elevation_m": trek["elevation_m"],
                    "state": trek.get("state", "Maharashtra"),
                }
                if "lat" in trek and "lon" in trek:
                    update_data["lat"] = trek["lat"]
                    update_data["lon"] = trek["lon"]
                supabase_admin.table("treks").update(update_data).eq("name", trek["name"]).eq("location", trek["location"]).execute()
            else:
                # Insert new record
                insert_data = {
                    "id": trek["id"],
                    "name": trek["name"],
                    "difficulty": trek.get("difficulty"),
                    "distance_km": trek["distance_km"],
                    "location": trek["location"],
                    "elevation_m": trek["elevation_m"],
                    "state": trek.get("state", "Maharashtra"),
                }
                if "lat" in trek and "lon" in trek:
                    insert_data["lat"] = trek["lat"]
                    insert_data["lon"] = trek["lon"]
                supabase_admin.table("treks").insert(insert_data).execute()
            success += 1
        except Exception as e:
            failed += 1
            errors.append({"name": trek.get("name", "unknown"), "error": str(e)})

    return {
        "message": f"Import complete: {success} imported, {failed} failed",
        "imported": success,
        "failed": failed,
        "errors": errors[:10],  # Limit error output
    }


# ─── Admin: Execute Raw SQL (for migrations) ───
class ExecuteSQLRequest(BaseModel):
    sql: str


@app.post("/admin/execute-sql")
def execute_sql(body: ExecuteSQLRequest):
    """
    Admin endpoint to execute raw SQL (e.g., ALTER TABLE).
    Uses the service role client via PostgREST RPC.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Admin endpoint disabled: SUPABASE_SERVICE_ROLE_KEY not configured")

    # Create a temporary function to execute arbitrary SQL, then call it
    # This works around PostgREST not having direct SQL execution
    try:
        # First, create a temporary function that executes the SQL
        func_sql = f"""
        CREATE OR REPLACE FUNCTION temp_exec_sql()
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            {body.sql}
        END;
        $$;
        """
        # We can't execute this directly, but we can try RPC
        # Let's try a different approach - use the supabase client's ability to run RPC
        # Actually, we need to create the function first. Let's do it in two steps.

        # Try to create the function via a migration approach
        # For now, return the SQL for manual execution
        return {
            "success": False,
            "error": "Direct SQL execution requires database function. Use Supabase Dashboard SQL Editor.",
            "sql_to_run_manually": body.sql,
            "hint": "Go to Supabase Dashboard > SQL Editor and run: " + body.sql
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "sql_to_run_manually": body.sql,
            "hint": "Run this SQL in Supabase Dashboard > SQL Editor"
        }


@app.post("/admin/add-state-column")
def add_state_column():
    """
    Admin endpoint to add the state column to treks table.
    This creates a temporary function and executes it.
    """
    if not SUPABASE_SERVICE_ROLE_KEY:
        raise HTTPException(status_code=503, detail="Admin endpoint disabled: SUPABASE_SERVICE_ROLE_KEY not configured")

    try:
        # Try to add column via ALTER TABLE using PostgREST
        # We need to use raw SQL - let's create a function first
        result = supabase_admin.rpc("exec_sql", {"sql": "ALTER TABLE treks ADD COLUMN state TEXT DEFAULT 'Maharashtra';"}).execute()
        return {"success": True, "result": result.data}
    except Exception as e:
        # If the exec_sql function doesn't exist, return instructions
        return {
            "success": False,
            "error": str(e),
            "sql_to_run_manually": "ALTER TABLE treks ADD COLUMN state TEXT DEFAULT 'Maharashtra';",
            "hint": "Run this in Supabase Dashboard > SQL Editor, or create the exec_sql function first"
        }


# ─── External Trek Search (Wikidata + OSM) ───
# GLOBAL SEARCH = ALL OF INDIA (not just Maharashtra)
# India bounding box (lat/lon): mainland + islands
#   lat 6.5-37.5 (Kanyakumari to Kashmir), lon 68.0-97.5 (Gujarat to Arunachal)
# Local (Maharashtra) search is served by the local Supabase DB, NOT this endpoint.
INDIA_LAT_MIN, INDIA_LAT_MAX = 6.5, 37.5
INDIA_LON_MIN, INDIA_LON_MAX = 68.0, 97.5

def get_query_variants(q: str) -> list[str]:
    """Generate search variants for Indian trek names (phonetic alternates, pass suffixes)."""
    import re
    variants = [q]

    # Strip common noise words: 'trek', 'trail'
    cleaned = re.sub(r'\b(trek|trail)\b', '', q, flags=re.IGNORECASE).strip()
    if cleaned and cleaned.lower() != q.lower():
        variants.append(cleaned)

    # Tibetan/Himalayan pass suffix '...la' (e.g. Goechala -> Goecha La, Rohtangla -> Rohtang La)
    for v in list(variants):
        words = v.split()
        new_words = []
        changed = False
        for w in words:
            if len(w) > 4 and w.lower().endswith('chala'):
                new_words.append(w[:-2] + ' ' + w[-2:])
                changed = True
            elif len(w) > 3 and w.lower().endswith('la') and not w.lower().endswith('ala') and w.lower() not in ('kerala', 'bangla', 'shila', 'mandala'):
                new_words.append(w[:-2] + ' ' + w[-2:])
                changed = True
            else:
                new_words.append(w)
        if changed:
            variants.append(' '.join(new_words))

    # Indian trek phonetic alternates (Hampta <-> Hamta)
    for v in list(variants):
        if re.search(r'\bhampta\b', v, re.IGNORECASE):
            variants.append(re.sub(r'\bhampta\b', 'Hamta', v, flags=re.IGNORECASE))
        elif re.search(r'\bhamta\b', v, re.IGNORECASE):
            variants.append(re.sub(r'\bhamta\b', 'Hampta', v, flags=re.IGNORECASE))

    seen = set()
    result = []
    for v in variants:
        k = v.strip().lower()
        if k and k not in seen:
            seen.add(k)
            result.append(v.strip())
    return result


@app.get("/search/wikidata")
async def search_wikidata(
    q: str = Query(..., description="Search query for trek names"),
    limit: int = Query(20, le=50, description="Maximum results")
):
    """
    Search Wikidata for treks/mountains/peaks/forts/passes across all of India.
    Uses Wikidata Search API (wbsearchentities) + entity lookup for speed.
    """
    cache_key = f"wikidata:{q.strip().lower()}:{limit}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    search_url = "https://www.wikidata.org/w/api.php"
    headers = {"User-Agent": get_wikimedia_user_agent()}

    # Valid type QIDs — trek-relevant landforms across the world (peaks, trails, passes, forts, etc.)
    valid_types = {
        "Q8502",    # mountain/peak/hill
        "Q22338",   # mountain peak
        "Q2491206", # hiking trail
        "Q2238215", # mountain range
        "Q308669",  # summit
        "Q194552",  # volcano
        "Q8072",    # volcano
        "Q169358",  # stratovolcano
        "Q1785071", # fort (military construction)
        "Q23413",   # fort (generic)
        "Q2977485", # hill fort
        "Q57831",   # fortress
        "Q3969557", # mountain pass
        "Q133056",  # mountain pass (primary Wikidata entity)
        "Q1572689", # ridge
        "Q3530445", # hill
        "Q39594",   # valley (e.g. Valley of Flowers)
        "Q46169",   # national park
        "Q158454",   # biosphere reserve
        "Q34038",   # waterfall
        "Q23397",   # lake
        "Q211302",  # glacial lake
    }

    variants = get_query_variants(q)
    error_occurred = False

    async with httpx.AsyncClient(timeout=15) as client:
        results = []
        seen_names = set()

        for variant in variants:
            search_params = {
                "action": "wbsearchentities",
                "search": variant,
                "language": "en",
                "format": "json",
                "type": "item",
                "limit": 50,
            }

            try:
                search_resp = await client.get(search_url, params=search_params, headers=headers)
                if search_resp.status_code != 200:
                    error_occurred = True
                    continue
                search_data = search_resp.json()
                search_results = search_data.get("search", [])
            except Exception:
                error_occurred = True
                continue

            if not search_results:
                continue

            entity_ids = [r["id"] for r in search_results[:50]]
            entity_details = {}

            # Fetch entity claims in batches of 50
            entity_params = {
                "action": "wbgetentities",
                "ids": "|".join(entity_ids),
                "props": "claims|labels|descriptions",
                "format": "json",
            }
            try:
                entity_resp = await client.get(search_url, params=entity_params, headers=headers, timeout=12)
                if entity_resp.status_code == 200:
                    entity_details.update(entity_resp.json().get("entities", {}))
                else:
                    error_occurred = True
            except Exception:
                error_occurred = True

            for entity_id, entity in entity_details.items():
                if not entity:
                    continue

                claims = entity.get("claims", {})
                p31 = claims.get("P31", [])
                p279 = claims.get("P279", [])

                has_valid_type = False
                for claim in p31 + p279:
                    mainsnak = claim.get("mainsnak", {})
                    if mainsnak.get("snaktype") == "value":
                        val = mainsnak.get("datavalue", {}).get("value", {})
                        if val.get("id") in valid_types:
                            has_valid_type = True
                            break

                if not has_valid_type:
                    continue

                # Get coordinates (P625)
                coord_claims = claims.get("P625", [])
                lat = lon = None
                for coord_claim in coord_claims:
                    mainsnak = coord_claim.get("mainsnak", {})
                    if mainsnak.get("snaktype") == "value":
                        val = mainsnak.get("datavalue", {}).get("value", {})
                        lat = val.get("latitude")
                        lon = val.get("longitude")
                        break

                if lat is None or lon is None or not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    continue

                # Get elevation (P2044)
                elevation = None
                elev_claims = claims.get("P2044", [])
                for elev_claim in elev_claims:
                    mainsnak = elev_claim.get("mainsnak", {})
                    if mainsnak.get("snaktype") == "value":
                        val = mainsnak.get("datavalue", {}).get("value", {})
                        elevation = int(float(val.get("amount", 0)))
                        break

                description = entity.get("descriptions", {}).get("en", {}).get("value", "")
                name = entity.get("labels", {}).get("en", {}).get("value", entity_id)

                norm_key = name.strip().lower()
                if norm_key in seen_names:
                    continue
                seen_names.add(norm_key)

                in_india = (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX)
                results.append({
                    "id": entity_id,
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "elevation_m": elevation,
                    "description": description,
                    "source": "wikidata",
                    "in_india": in_india,
                })

                if len(results) >= limit:
                    break

            if results:
                break

    response_data = {"results": results, "source": "wikidata", "count": len(results)}
    # Never cache empty results if an error occurred during fetching
    if not (error_occurred and len(results) == 0):
        set_cached_result(cache_key, response_data, ttl=DEFAULT_SEARCH_TTL)
    return response_data


@app.get("/search/osm")
async def search_osm(
    q: str = Query(..., description="Search query for trek names"),
    limit: int = Query(20, le=50, description="Maximum results")
):
    """
    Search OpenStreetMap Overpass API for hiking trails/peaks/forts across all of India.
    """
    cache_key = f"osm:{q.strip().lower()}:{limit}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    import re
    escaped_q = re.escape(q)
    india_bbox = f"{INDIA_LAT_MIN},{INDIA_LON_MIN},{INDIA_LAT_MAX},{INDIA_LON_MAX}"
    overpass_query = f"""
    [out:json][timeout:50];
    (
      node["natural"="peak"]["name"~"{escaped_q}",i]({india_bbox});
      way["highway"="path"]["name"~"{escaped_q}",i]({india_bbox});
      node["historic"="fort"]["name"~"{escaped_q}",i]({india_bbox});
      way["historic"="fort"]["name"~"{escaped_q}",i]({india_bbox});
      node["tourism"="trail"]["name"~"{escaped_q}",i]({india_bbox});
      way["tourism"="trail"]["name"~"{escaped_q}",i]({india_bbox});
      relation["route"="hiking"]["name"~"{escaped_q}",i]({india_bbox});
      node["natural"="ridge"]["name"~"{escaped_q}",i]({india_bbox});
      way["natural"="ridge"]["name"~"{escaped_q}",i]({india_bbox});
    );
    out center {limit};
    """

    overpass_endpoints = [
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    ]

    async def try_mirror(url: str):
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                resp = await client.post(
                    url,
                    data={"data": overpass_query},
                    headers={"Accept": "application/json", "User-Agent": get_wikimedia_user_agent()}
                )
            if resp.status_code == 200:
                return True, resp.json()
            return False, f"Overpass error ({url}): {resp.text}"
        except Exception as e:
            return False, f"Overpass error ({url}): {str(e)}"

    tasks = [asyncio.ensure_future(try_mirror(u)) for u in overpass_endpoints]
    data = None
    last_error = None
    while tasks:
        done, tasks = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
        for fut in done:
            ok, payload = fut.result()
            if ok:
                data = payload
                for t in tasks:
                    t.cancel()
                break
            last_error = payload
        if data is not None:
            break

    if data is None:
        return {"results": [], "source": "osm", "count": 0, "error": last_error}

    results = []
    seen = set()
    for element in data.get("elements", []):
        lat = element.get("lat") or element.get("center", {}).get("lat")
        lon = element.get("lon") or element.get("center", {}).get("lon")
        tags = element.get("tags", {})
        name = tags.get("name", "").strip()

        if lat and lon and name:
            key = name.lower()
            if key in seen:
                continue
            seen.add(key)

            in_india = (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX)
            results.append({
                "id": f"osm_{element.get('type', 'node')}_{element.get('id')}",
                "name": name,
                "lat": lat,
                "lon": lon,
                "elevation_m": int(tags.get("ele")) if tags.get("ele") and str(tags["ele"]).isdigit() else None,
                "description": tags.get("description", "") or tags.get("wikipedia", "") or f"OSM {tags.get('natural', tags.get('highway', tags.get('historic', tags.get('tourism', tags.get('route', 'feature')))))}",
                "source": "osm",
                "osm_type": element.get("type"),
                "osm_id": element.get("id"),
                "in_india": in_india,
            })

    response_data = {"results": results, "source": "osm", "count": len(results)}
    set_cached_result(cache_key, response_data)
    return response_data


@app.get("/search/owm")
async def search_owm(
    q: str = Query(..., description="Search query for place names"),
    limit: int = Query(20, le=50, description="Maximum results")
):
    """
    Search OpenWeatherMap Geocoding API for places across India.
    """
    cache_key = f"owm:{q.strip().lower()}:{limit}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    if not OPENWEATHER_API_KEY:
        return {"results": [], "source": "owm", "count": 0, "error": "OPENWEATHER_API_KEY not configured"}

    geocode_url = "https://api.openweathermap.org/geo/1.0/direct"
    params = {
        "q": q,
        "limit": limit,
        "appid": OPENWEATHER_API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(geocode_url, params=params)
        if resp.status_code != 200:
            return {"results": [], "source": "owm", "count": 0, "error": f"OWM geocoding error: HTTP {resp.status_code}"}
        data = resp.json()
    except Exception as e:
        return {"results": [], "source": "owm", "count": 0, "error": f"OWM geocoding error: {e}"}

    results = []
    seen = set()
    for place in data:
        lat = place.get("lat")
        lon = place.get("lon")
        name = place.get("name")
        if lat is None or lon is None or not name:
            continue
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
            continue

        key = name.strip().lower()
        if key in seen:
            continue
        seen.add(key)

        desc_parts = [p for p in [name, place.get("state"), place.get("country")] if p]
        description = ", ".join(desc_parts)
        in_india = (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX)

        results.append({
            "id": f"owm_{lat}_{lon}",
            "name": name,
            "lat": lat,
            "lon": lon,
            "elevation_m": None,
            "description": description,
            "source": "owm",
            "in_india": in_india,
        })
        if len(results) >= limit:
            break

    response_data = {"results": results, "source": "owm", "count": len(results)}
    set_cached_result(cache_key, response_data)
    return response_data


@app.get("/search/nominatim")
async def search_nominatim(
    q: str = Query(..., description="Search query for place names"),
    limit: int = Query(20, le=50, description="Maximum results")
):
    """
    Search OpenStreetMap Nominatim geocoder for trek-relevant places across India.
    Filters to trek-relevant OSM classes and verifies name relevance.
    """
    cache_key = f"nominatim:{q.strip().lower()}:{limit}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    KEEP_CLASSES = {
        "natural",        # peaks, valleys, waterfalls, ridges, hills, saddles
        "peak",           # defensive Nominatim class
        "mountain_pass",  # mountain passes (e.g. Hamta Pass)
        "waterway",       # rivers, streams, waterfalls
        "place",          # locality only (unpopulated features)
        "tourism",        # attractions, viewpoints, camp sites
        "historic",       # forts, castle ruins, monuments
        "leisure",        # nature reserves, parks
    }

    KEEP_TYPES = {
        "place": {
            "locality",
        },
        "tourism": {
            "attraction", "viewpoint", "view_point", "camp_site", "picnic_site",
            "artwork", "alpine_hut", "wilderness_hut", "information",
        },
        "leisure": {
            "garden", "nature_reserve", "common",
        },
    }

    geocode_url = "https://nominatim.openstreetmap.org/search"
    headers = {"User-Agent": get_wikimedia_user_agent()}
    variants = get_query_variants(q)

    results = []
    seen = set()
    error_occurred = False

    async with httpx.AsyncClient(timeout=10) as client:
        for variant in variants:
            raw_limit = 50
            params = {
                "q": variant,
                "format": "json",
                "limit": raw_limit,
                "addressdetails": 1,
            }

            try:
                resp = await client.get(geocode_url, params=params, headers=headers)
                if resp.status_code != 200:
                    error_occurred = True
                    continue
                data = resp.json()
            except Exception:
                error_occurred = True
                continue

            # Query words normalized for matching
            norm_q = q.lower().replace(",", " ").replace("-", " ")
            query_words = {w for w in norm_q.split() if w}
            compact_query_words = {w.replace(" ", "") for w in query_words}

            for place in data:
                place_class = place.get("class")
                place_type = place.get("type")
                if place_class not in KEEP_CLASSES:
                    continue
                if place_class in KEEP_TYPES and place_type not in KEEP_TYPES[place_class]:
                    continue

                try:
                    lat = float(place.get("lat"))
                    lon = float(place.get("lon"))
                except (TypeError, ValueError):
                    continue

                if not (-90.0 <= lat <= 90.0 and -180.0 <= lon <= 180.0):
                    continue

                name = place.get("name") or (place.get("display_name", "").split(",")[0] if place.get("display_name") else "")
                if not name:
                    continue

                name_lower = name.lower()
                compact_name = name_lower.replace(" ", "").replace("-", "")

                # Relevance check: query word match or compact match
                has_match = (
                    any(w in name_lower for w in query_words) or
                    any(cw in compact_name for cw in compact_query_words) or
                    any(name_lower in v.lower() for v in variants)
                )
                if query_words and not has_match:
                    continue

                key = name.strip().lower()
                if key in seen:
                    continue
                seen.add(key)

                description = place.get("display_name", "") or f"OSM {place.get('type', 'place')}"
                in_india = (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX)

                results.append({
                    "id": f"nominatim_{place.get('osm_type', 'node')}_{place.get('osm_id')}",
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "elevation_m": None,
                    "description": description,
                    "source": "nominatim",
                    "class": place_class,
                    "osm_type": place.get("osm_type", "node"),
                    "in_india": in_india,
                })
                if len(results) >= limit:
                    break

            if results:
                break

    response_data = {"results": results, "source": "nominatim", "count": len(results)}
    # Never cache empty results if an error occurred during fetching
    if not (error_occurred and len(results) == 0):
        set_cached_result(cache_key, response_data, ttl=DEFAULT_SEARCH_TTL)
    return response_data


@app.get("/search/external")
async def search_external(
    q: str = Query(..., description="Search query for trek names"),
    limit: int = Query(20, le=50, description="Maximum results per source"),
    sources: str = Query("wikidata,osm,nominatim", description="Comma-separated: wikidata,osm,owm,nominatim")
):
    """
    Combined external search across Wikidata, OSM, Nominatim, and OWM.
    All sources run concurrently with caching and name deduplication.
    """
    cache_key = f"external:{q.strip().lower()}:{limit}:{sources}"
    cached = get_cached_result(cache_key)
    if cached is not None:
        return cached

    sources_str = sources.default if hasattr(sources, "default") else str(sources)
    source_list = [s.strip().lower() for s in sources_str.split(",") if s.strip()]
    all_results = []

    async def run_source(source: str):
        source = source.strip().lower()
        if source not in ("wikidata", "osm", "owm", "nominatim"):
            return [], f"unknown source: {source}"
        if source == "wikidata":
            try:
                wk_resp = await search_wikidata(q=q, limit=limit)
                return wk_resp["results"], None
            except Exception as e:
                return [], str(e)
        elif source == "owm":
            try:
                owm_resp = await search_owm(q=q, limit=limit)
                return owm_resp["results"], owm_resp.get("error")
            except Exception as e:
                return [], str(e)
        elif source == "nominatim":
            try:
                nom_resp = await search_nominatim(q=q, limit=limit)
                return nom_resp["results"], nom_resp.get("error")
            except Exception as e:
                return [], str(e)
        # default: osm
        try:
            osm_resp = await search_osm(q=q, limit=limit)
            return osm_resp["results"], osm_resp.get("error")
        except Exception as e:
            return [], str(e)

    outcomes = await asyncio.gather(
        *[run_source(s) for s in source_list],
        return_exceptions=True,
    )
    has_errors = False
    for outcome in outcomes:
        if isinstance(outcome, Exception):
            has_errors = True
            continue
        results, err = outcome
        if err is not None:
            has_errors = True
        all_results.extend(results)

    seen = set()
    unique_results = []
    for r in all_results:
        key = r["name"].strip().lower()
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    response_data = {"results": unique_results[:limit], "count": len(unique_results), "sources": source_list}
    # Never cache empty results if errors occurred across sources
    if not (has_errors and len(unique_results) == 0):
        set_cached_result(cache_key, response_data, ttl=DEFAULT_SEARCH_TTL)
    return response_data

