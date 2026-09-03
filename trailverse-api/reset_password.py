# reset_password.py
from argon2 import PasswordHasher
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
pwd_context = PasswordHasher()

# Set your new password here (value supplied via NEW_PASSWORD env var, not source)
NEW_PASSWORD = os.getenv("NEW_PASSWORD")
if not NEW_PASSWORD:
    raise SystemExit("NEW_PASSWORD environment variable is not set")
new_password = NEW_PASSWORD
target_username = "varada"

new_hash = pwd_context.hash(new_password)

supabase.table("users") \
    .update({"password_hash": new_hash}) \
    .eq("username", target_username) \
    .execute()

print(f"Password for '{target_username}' set successfully.")