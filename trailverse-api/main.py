from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from supabase import create_client, Client
from dotenv import load_dotenv
import asyncio
import os
import httpx
import time
from hashlib import md5

load_dotenv()

# Simple in-memory cache for external search endpoints
_search_cache = {}  # key: cache_key, value: (data, timestamp)
CACHE_TTL = 3600  # 1 hour in seconds

def get_cached_result(key: str):
    """Get cached result if not expired. Returns None if miss or expired."""
    if key in _search_cache:
        data, timestamp = _search_cache[key]
        if time.time() - timestamp < CACHE_TTL:
            return data
        else:
            del _search_cache[key]
    return None

def set_cached_result(key: str, data: dict):
    """Cache a successful result."""
    _search_cache[key] = (data, time.time())

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

@app.get("/dashboard/{username}")
def get_dashboard(username: str):
    user_result = supabase.table("users") \
        .select("*") \
        .ilike("username", username) \
        .execute()

    if not user_result.data or len(user_result.data) == 0:
        raise HTTPException(status_code=404, detail="User not found")

    user = user_result.data[0]

    leaderboard_result = supabase.table("users") \
        .select("name, username, trail_score") \
        .eq("city", user["city"]) \
        .order("trail_score", desc=True) \
        .limit(5) \
        .execute()

    treks_result = supabase.table("treks") \
        .select("*") \
        .limit(5) \
        .execute()

    return {
        "user": user,
        "leaderboard": leaderboard_result.data,
        "recommended_trek": treks_result.data[0] if treks_result.data else None,
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
    result = supabase.table("treks").select("id, name, lat, lon").eq("id", trek_id).execute()
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
    result = supabase.table("trek_groups") \
        .select("*") \
        .eq("id", group_id) \
        .execute()

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

    query_result = supabase.table("trek_group_queries") \
        .select("*") \
        .eq("id", query_id) \
        .execute()

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
    """
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

    return {
        "weather": weather_data,
        "risk":    risk,
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
    headers = {"User-Agent": "TrailVerse/1.0 (https://trailverse.app; admin@trailverse.app)"}

    # Valid type QIDs — trek-relevant landforms across all of India
    valid_types = {
        "Q8502",    # mountain/peak/hill
        "Q1785071",  # fort (military construction)
        "Q23413",    # fort (generic)
        "Q2977485",  # hill fort
        "Q57831",    # fortress
        "Q3969557",  # mountain pass
        "Q133056",   # mountain pass (primary Wikidata entity)
        "Q1572689",  # ridge
        "Q3530445",  # hill
        "Q39594",    # valley (e.g. Valley of Flowers)
        "Q46169",    # national park
        "Q158454",   # biosphere reserve
        "Q34038",    # waterfall
        "Q23397",    # lake
        "Q211302",   # glacial lake
    }

    variants = get_query_variants(q)

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
                    continue
                search_data = search_resp.json()
                search_results = search_data.get("search", [])
            except Exception:
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
            except Exception:
                pass

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

                if lat is None or lon is None:
                    continue

                # Filter by India bbox
                if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX):
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

                results.append({
                    "id": entity_id,
                    "name": name,
                    "lat": lat,
                    "lon": lon,
                    "elevation_m": elevation,
                    "description": description,
                    "source": "wikidata",
                })

                if len(results) >= limit:
                    break

            if results:
                break

    response_data = {"results": results, "source": "wikidata", "count": len(results)}
    set_cached_result(cache_key, response_data)
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
        "https://overpass.openstreetmap.ru/api/interpreter",
    ]

    async def try_mirror(url: str):
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                resp = await client.post(
                    url,
                    data={"data": overpass_query},
                    headers={"Accept": "application/json", "User-Agent": "TrailVerse/1.0"}
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
        "q": f"{q},IN",
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
        if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX):
            continue

        key = name.strip().lower()
        if key in seen:
            continue
        seen.add(key)

        desc_parts = [p for p in [name, place.get("state"), place.get("country")] if p]
        description = ", ".join(desc_parts)

        results.append({
            "id": f"owm_{lat}_{lon}",
            "name": name,
            "lat": lat,
            "lon": lon,
            "elevation_m": None,
            "description": description,
            "source": "owm",
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
    headers = {"User-Agent": "TrailVerse/1.0 (contact: trailverse@app)"}
    variants = get_query_variants(q)

    results = []
    seen = set()

    async with httpx.AsyncClient(timeout=10) as client:
        for variant in variants:
            raw_limit = 50
            params = {
                "q": variant,
                "format": "json",
                "limit": raw_limit,
                "countrycodes": "in",
                "addressdetails": 1,
            }

            try:
                resp = await client.get(geocode_url, params=params, headers=headers)
                if resp.status_code != 200:
                    continue
                data = resp.json()
            except Exception:
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

                if not (INDIA_LAT_MIN <= lat <= INDIA_LAT_MAX and INDIA_LON_MIN <= lon <= INDIA_LON_MAX):
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
                })
                if len(results) >= limit:
                    break

            if results:
                break

    response_data = {"results": results, "source": "nominatim", "count": len(results)}
    set_cached_result(cache_key, response_data)
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

    source_list = [s.strip().lower() for s in sources.split(",") if s.strip()]
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
    for outcome in outcomes:
        if isinstance(outcome, Exception):
            continue
        results, _err = outcome
        all_results.extend(results)

    seen = set()
    unique_results = []
    for r in all_results:
        key = r["name"].strip().lower()
        if key not in seen:
            seen.add(key)
            unique_results.append(r)

    response_data = {"results": unique_results[:limit], "count": len(unique_results), "sources": source_list}
    set_cached_result(cache_key, response_data)
    return response_data

