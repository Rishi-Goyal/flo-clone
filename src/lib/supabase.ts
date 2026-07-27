import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && anonKey)
export const isNative = Capacitor.isNativePlatform()

/** Where the magic link lands: the Android app via deep link, or the web origin. */
export function authRedirectUrl(): string {
  return isNative ? 'com.rishi.bloom://login-callback' : window.location.origin
}

// A dummy client keeps the app importable before env vars are set;
// App renders a setup screen instead of crashing.
// PKCE flow so the Android deep-link callback can exchange a code in-app.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder-anon-key',
  { auth: { flowType: 'pkce', detectSessionInUrl: true } },
)

export function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
