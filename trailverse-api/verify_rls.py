#!/usr/bin/env python3
"""
verify_rls.py - Verification script for Row Level Security (RLS) enforcement.
Uses ONLY the anonymous key for probes.
Validates:
  - Anon key's JWT payload explicitly has role == "anon" (hard-fails otherwise).
  - SELECT * on all 10 tables:
      * DENIED (PASS) if PostgreSQL APIError code == '42501' or message has 'permission denied for'.
      * FILTERED (PASS) if query returns 0 rows while table has rows via service-role.
      * EMPTY (INCONCLUSIVE) if table is empty in DB.
      * DATA RETURNED (FAIL) if data is returned to anon.
  - SELECT password_hash on users:
      * DENIED (PASS) if blocked.
      * DATA RETURNED (FAIL) if ANY rows returned (regardless of content).
  - INSERT, UPDATE, DELETE on users, trek_groups, user_treks:
      * INSERT uses real column names and '__rls_probe__' marker; if it succeeds, reports FAIL and deletes via service role.
      * UPDATE/DELETE uses real column names and nil UUID filter ('00000000-0000-0000-0000-000000000000').
        Only 42501 is PASS. Success with 0 rows is NOT DENIED (INCONCLUSIVE). Success with rows is FAIL.
  - Never prints API keys or row contents.
  - Exit codes:
      * 0: Strict success (zero FAIL, zero INCONCLUSIVE).
      * 1: Any FAIL.
      * 2: Zero FAIL, but inconclusive/errors present.
      * (--expect-open flag exits 0 and summarizes leaked probes for pre-migration run).
"""

import os
import sys
import json
import base64
from dotenv import load_dotenv

# Load environment
_api_env = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(_api_env):
    load_dotenv(dotenv_path=_api_env)
else:
    load_dotenv()

from supabase import create_client, Client

NIL_UUID = "00000000-0000-0000-0000-000000000000"
PROBE_MARKER = "__rls_probe__"

TABLES = [
    "users",
    "treks",
    "trek_groups",
    "user_treks",
    "trek_group_members",
    "trek_group_messages",
    "trek_group_queries",
    "trek_group_query_replies",
    "badges",
    "user_badges",
]

# ── Classification Logic (Pure functions for testability) ───────────────────

def classify_exception(exc: Exception) -> tuple[bool, str]:
    """
    Returns (is_denied, details_string).
    is_denied is True ONLY if PostgREST/Postgres code == '42501'
    or 'permission denied for' is in the message.
    Never matches 401, 403, unauthorized, jwt expired, or not permitted.
    details_string NEVER includes arbitrary message bodies that might contain data.
    """
    code = getattr(exc, "code", None)
    msg = ""
    if hasattr(exc, "message") and isinstance(exc.message, str):
        msg = exc.message
    elif len(exc.args) > 0 and isinstance(exc.args[0], str):
        msg = exc.args[0]
    elif len(exc.args) > 0 and isinstance(exc.args[0], dict):
        code = code or exc.args[0].get("code")
        msg = str(exc.args[0].get("message", ""))

    code_str = str(code).strip() if code is not None else ""
    is_42501 = (code_str == "42501")
    has_perm_denied = "permission denied for" in msg.lower()

    if is_42501 or has_perm_denied:
        code_part = f" [code: {code_str}]" if code_str else ""
        return (True, f"Permission denied (PostgreSQL 42501){code_part}")

    code_part = f" code={code_str}" if code_str else ""
    return (False, f"Exception: {type(exc).__name__}{code_part}")

def classify_select_result(rows: list | None, actual_count: int | None) -> tuple[str, str]:
    """Classify SELECT result when no exception occurred."""
    if rows is not None and len(rows) > 0:
        return ("DATA RETURNED (FAIL)", f"Leaked {len(rows)} row(s) to anon")
    if actual_count is not None and actual_count > 0:
        return ("FILTERED (PASS)", f"Table has {actual_count} rows; anon sees 0 (RLS active)")
    if actual_count == 0:
        return ("EMPTY (INCONCLUSIVE)", "Table has 0 rows in database")
    return ("EMPTY (INCONCLUSIVE)", "Service-role row count unavailable")

def extract_jwt_role(token: str) -> str:
    """Extract the role claim from a JWT without external libraries."""
    try:
        parts = token.strip().split(".")
        if len(parts) != 3:
            return ""
        payload_b64 = parts[1]
        padded = payload_b64 + "=" * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8"))
        return payload.get("role", "")
    except Exception:
        return ""

# ── Probe Execution ──────────────────────────────────────────────────────────

def run_rls_verification():
    expect_open = "--expect-open" in sys.argv

    SUPABASE_URL = os.getenv("SUPABASE_URL")
    ANON_KEY = os.getenv("SUPABASE_ANON_KEY") or os.getenv("SUPABASE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
    SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not SUPABASE_URL:
        sys.exit("CRITICAL ERROR: SUPABASE_URL is missing.")

    if not ANON_KEY:
        sys.exit("CRITICAL ERROR: SUPABASE_ANON_KEY is missing from environment.")

    anon_role = extract_jwt_role(ANON_KEY)
    if anon_role != "anon":
        sys.exit(f"CRITICAL ERROR: Probe key role is NOT 'anon' (detected role: '{anon_role}'). Aborting to prevent accidental probe with privileged key.")

    anon_client: Client = create_client(SUPABASE_URL, ANON_KEY)

    admin_client: Client | None = None
    if SERVICE_ROLE_KEY:
        admin_role = extract_jwt_role(SERVICE_ROLE_KEY)
        if admin_role == "service_role":
            admin_client = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

    def get_table_count(table: str) -> int | None:
        if not admin_client:
            return None
        try:
            res = admin_client.table(table).select("*", count="exact", head=True).execute()
            return res.count if res.count is not None else 0
        except Exception:
            return None

    # Fetch schema references for FK-valid payloads if admin client is present
    valid_user_id = None
    valid_trek_id = None
    if admin_client:
        try:
            u_res = admin_client.table("users").select("id").limit(1).execute()
            if u_res.data:
                valid_user_id = u_res.data[0]["id"]
        except Exception:
            pass
        try:
            t_res = admin_client.table("treks").select("id").limit(1).execute()
            if t_res.data:
                valid_trek_id = t_res.data[0]["id"]
        except Exception:
            pass

    results = []

    # ── A. SELECT * PROBES (All 10 tables) ───────────────────────────────────
    for table in TABLES:
        actual_count = get_table_count(table)
        try:
            res = anon_client.table(table).select("*").limit(5).execute()
            status, details = classify_select_result(res.data, actual_count)
            results.append((f"SELECT * on '{table}'", status, details))
        except Exception as e:
            is_denied, details = classify_exception(e)
            if is_denied:
                results.append((f"SELECT * on '{table}'", "DENIED (PASS)", details))
            else:
                results.append((f"SELECT * on '{table}'", "ERROR (INCONCLUSIVE)", details))

    # ── B. SELECT password_hash on users ─────────────────────────────────────
    users_count = get_table_count("users")
    try:
        res = anon_client.table("users").select("password_hash").limit(5).execute()
        rows = res.data or []
        # Requirement: if ANY rows come back, FAIL, whatever the content
        if len(rows) > 0:
            results.append(("SELECT password_hash on 'users'", "DATA RETURNED (FAIL)", f"Leaked {len(rows)} row(s)"))
        else:
            if users_count is not None and users_count > 0:
                results.append(("SELECT password_hash on 'users'", "FILTERED (PASS)", f"Table has {users_count} rows; anon sees 0"))
            elif users_count == 0:
                results.append(("SELECT password_hash on 'users'", "EMPTY (INCONCLUSIVE)", "Users table is empty in DB"))
            else:
                results.append(("SELECT password_hash on 'users'", "EMPTY (INCONCLUSIVE)", "Users count unavailable"))
    except Exception as e:
        is_denied, details = classify_exception(e)
        if is_denied:
            results.append(("SELECT password_hash on 'users'", "DENIED (PASS)", details))
        else:
            results.append(("SELECT password_hash on 'users'", "ERROR (INCONCLUSIVE)", details))

    # ── C. INSERT PROBES (Real columns, UUID/FK valid, __rls_probe__ marker) ──
    # users: username (text), email (text), name (text), password_hash (text), city (text)
    # trek_groups: host_id (uuid FK), title (text), location (text), cost (numeric), description (text)
    # user_treks: user_id (uuid FK), trek_id (uuid/str FK), date (date/str), duration_mins (int), review (text)
    user_payload = {
        "username": PROBE_MARKER,
        "email": f"{PROBE_MARKER}@probe.invalid",
        "name": PROBE_MARKER,
        "password_hash": PROBE_MARKER,
        "city": PROBE_MARKER,
    }
    group_payload = {
        "host_id": valid_user_id or NIL_UUID,
        "title": PROBE_MARKER,
        "location": "Probe Location",
        "cost": 0,
        "description": PROBE_MARKER,
    }
    user_trek_payload = {
        "user_id": valid_user_id or NIL_UUID,
        "trek_id": valid_trek_id or NIL_UUID,
        "date": "2026-01-01",
        "duration_mins": 60,
        "review": PROBE_MARKER,
    }

    insert_targets = [
        ("users", user_payload),
        ("trek_groups", group_payload),
        ("user_treks", user_trek_payload),
    ]

    for table, payload in insert_targets:
        inserted_id = None
        try:
            res = anon_client.table(table).insert(payload).execute()
            rows = res.data or []
            if len(rows) > 0:
                inserted_id = rows[0].get("id") if isinstance(rows[0], dict) else None
                results.append((f"INSERT on '{table}'", "DATA RETURNED (FAIL)", "Anonymous INSERT succeeded"))
            else:
                results.append((f"INSERT on '{table}'", "NOT DENIED (INCONCLUSIVE)", "Insert returned 0 rows without error"))
        except Exception as e:
            is_denied, details = classify_exception(e)
            if is_denied:
                results.append((f"INSERT on '{table}'", "DENIED (PASS)", details))
            else:
                results.append((f"INSERT on '{table}'", "ERROR (INCONCLUSIVE)", details))
        finally:
            # Cleanup probe-inserted rows using service-role client
            if admin_client:
                if inserted_id:
                    try:
                        admin_client.table(table).delete().eq("id", inserted_id).execute()
                    except Exception:
                        pass
                if table == "users":
                    try:
                        admin_client.table("users").delete().eq("username", PROBE_MARKER).execute()
                    except Exception:
                        pass
                elif table == "trek_groups":
                    try:
                        admin_client.table("trek_groups").delete().eq("title", PROBE_MARKER).execute()
                    except Exception:
                        pass
                elif table == "user_treks":
                    try:
                        admin_client.table("user_treks").delete().eq("review", PROBE_MARKER).execute()
                    except Exception:
                        pass

    # ── D. UPDATE & DELETE PROBES (Real columns, nil UUID filter) ────────────
    # users: column city (text), filter id (uuid) == NIL_UUID
    # trek_groups: column title (text), filter id (uuid) == NIL_UUID
    # user_treks: column review (text), filter id (uuid) == NIL_UUID
    mutation_targets = [
        ("users", {"city": PROBE_MARKER}),
        ("trek_groups", {"title": PROBE_MARKER}),
        ("user_treks", {"review": PROBE_MARKER}),
    ]

    for table, update_payload in mutation_targets:
        # UPDATE with nil UUID filter
        try:
            res = anon_client.table(table).update(update_payload).eq("id", NIL_UUID).execute()
            rows = res.data or []
            if len(rows) > 0:
                results.append((f"UPDATE on '{table}'", "DATA RETURNED (FAIL)", f"{len(rows)} row(s) updated"))
            else:
                results.append((f"UPDATE on '{table}'", "NOT DENIED (INCONCLUSIVE)", "Query executed without 42501 (0 rows affected)"))
        except Exception as e:
            is_denied, details = classify_exception(e)
            if is_denied:
                results.append((f"UPDATE on '{table}'", "DENIED (PASS)", details))
            else:
                results.append((f"UPDATE on '{table}'", "ERROR (INCONCLUSIVE)", details))

        # DELETE with nil UUID filter
        try:
            res = anon_client.table(table).delete().eq("id", NIL_UUID).execute()
            rows = res.data or []
            if len(rows) > 0:
                results.append((f"DELETE on '{table}'", "DATA RETURNED (FAIL)", f"{len(rows)} row(s) deleted"))
            else:
                results.append((f"DELETE on '{table}'", "NOT DENIED (INCONCLUSIVE)", "Query executed without 42501 (0 rows affected)"))
        except Exception as e:
            is_denied, details = classify_exception(e)
            if is_denied:
                results.append((f"DELETE on '{table}'", "DENIED (PASS)", details))
            else:
                results.append((f"DELETE on '{table}'", "ERROR (INCONCLUSIVE)", details))

    # ── E. Report & Exit Codes ───────────────────────────────────────────────
    print("\n" + "=" * 95)
    print("🛡️   SUPABASE ROW LEVEL SECURITY (RLS) AUDIT PROBE (ANON ROLE ONLY)")
    print("=" * 95)
    print(f"{'Table / Operation':<38} | {'Status':<24} | {'Details'}")
    print("-" * 95)

    pass_count = 0
    fail_count = 0
    inconclusive_count = 0

    for op, status, details in results:
        if "PASS" in status:
            pass_count += 1
            icon = "✅"
        elif "FAIL" in status:
            fail_count += 1
            icon = "❌"
        else:
            inconclusive_count += 1
            icon = "⚠️ "

        print(f"{op:<38} | {icon} {status:<21} | {details}")

    print("=" * 95)
    print(f"Summary: {pass_count} PASSED, {fail_count} FAILED, {inconclusive_count} INCONCLUSIVE out of {len(results)} total checks.")
    print("=" * 95 + "\n")

    if expect_open:
        leaked = [r for r in results if "FAIL" in r[1]]
        print("[--expect-open mode]")
        if leaked:
            print(f"Detected {len(leaked)} open probe(s) leaking data to anon (expected before RLS migration):")
            for op, status, details in leaked:
                print(f"  - {op}: {details}")
        else:
            print("No open probes detected.")
        sys.exit(0)

    # Strict mode exit codes:
    # 0: only if zero FAIL and zero INCONCLUSIVE/ERROR
    # 1: if any FAIL
    # 2: if zero FAIL, but inconclusive/errors present
    if fail_count > 0:
        sys.exit(1)
    elif inconclusive_count > 0:
        sys.exit(2)
    else:
        sys.exit(0)

if __name__ == "__main__":
    run_rls_verification()
