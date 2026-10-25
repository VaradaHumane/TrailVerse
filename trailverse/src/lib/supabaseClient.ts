import { createClient } from "@supabase/supabase-js"

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "https://hewmnxdmjydfnrtliowb.supabase.co"
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhld21ueGRtanlkZm5ydGxpb3diIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEwNzUzNDEsImV4cCI6MjA5NjY1MTM0MX0.zC9NbWcYfkPNJeQZBJC96um9zFLHKrjBenetKRsrGjs"

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
