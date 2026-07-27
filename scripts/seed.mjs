// Seeds ~6 months of realistic sample data into an EXISTING tracker account.
// Prerequisites: the account has signed in once and completed onboarding
// (so its default trackers exist).
//
//   1. Fill SUPABASE_SERVICE_ROLE_KEY and SEED_EMAIL in .env.local
//   2. npm run seed
//
// Idempotent-ish: re-running upserts the same date range again.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// --- tiny .env.local parser (no dotenv dependency)
const env = {}
try {
  for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) env[m[1]] = m[2].trim()
  }
} catch {
  console.error('Create .env.local first (copy .env.example).')
  process.exit(1)
}

const { VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_EMAIL } = env
if (!VITE_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SEED_EMAIL) {
  console.error('Need VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_EMAIL in .env.local')
  process.exit(1)
}

const db = createClient(VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (isoDate, n) => {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1))
const pick = (arr) => arr[rand(0, arr.length - 1)]

// --- find the user
const { data: users, error: userErr } = await db.auth.admin.listUsers({ perPage: 1000 })
if (userErr) throw userErr
const user = users.users.find((u) => u.email?.toLowerCase() === SEED_EMAIL.toLowerCase())
if (!user) {
  console.error(`No user with email ${SEED_EMAIL}. Sign in once in the app first.`)
  process.exit(1)
}
console.log(`Seeding for ${SEED_EMAIL} (${user.id})`)

// --- fetch trackers (must exist from onboarding)
const { data: trackers } = await db.from('trackers').select('*').eq('user_id', user.id)
if (!trackers?.length) {
  console.error('No trackers found — complete onboarding in the app first (choose "I track my cycle").')
  process.exit(1)
}
const byKey = Object.fromEntries(trackers.map((t) => [t.system_key ?? t.name.toLowerCase(), t]))
const flow = byKey['period_flow']
const cramps = trackers.find((t) => t.name === 'Cramps')
const mood = trackers.find((t) => t.name === 'Mood')
const energy = trackers.find((t) => t.name === 'Energy')
const sleep = trackers.find((t) => t.name === 'Sleep')
if (!flow) {
  console.error('No period_flow tracker found.')
  process.exit(1)
}

// --- generate ~6 cycles ending near today
const today = iso(new Date())
const periodStarts = []
let cursor = addDays(today, -170)
while (cursor < addDays(today, -10)) {
  periodStarts.push(cursor)
  cursor = addDays(cursor, rand(27, 31))
}

const rows = []
const flowValues = ['medium', 'heavy', 'heavy', 'medium', 'light', 'spotting']
for (const start of periodStarts) {
  const len = rand(4, 6)
  for (let d = 0; d < len; d++) {
    rows.push({ user_id: user.id, tracker_id: flow.id, date: addDays(start, d), value: flowValues[Math.min(d, 5)] })
  }
  // cramps 1–2 days before the period and on day 1
  if (cramps) {
    for (const off of [-2, -1, 0]) {
      if (Math.random() < 0.8) rows.push({ user_id: user.id, tracker_id: cramps.id, date: addDays(start, off), value: true })
    }
  }
}

// mood / energy / sleep noise on ~60% of all days in range
const firstDay = periodStarts[0]
const totalDays = Math.round((new Date(today) - new Date(firstDay)) / 86400000)
for (let i = 0; i < totalDays; i++) {
  const date = addDays(firstDay, i)
  // rough phase: days since most recent period start
  const lastStart = [...periodStarts].reverse().find((s) => s <= date) ?? firstDay
  const cycleDay = Math.round((new Date(date) - new Date(lastStart)) / 86400000) + 1
  const isMenstrual = cycleDay <= 5
  const isLateLuteal = cycleDay >= 24
  if (energy && Math.random() < 0.6) {
    const base = isMenstrual ? 2 : isLateLuteal ? 2.5 : 4
    rows.push({ user_id: user.id, tracker_id: energy.id, date, value: Math.max(1, Math.min(5, Math.round(base + (Math.random() * 2 - 1)))) })
  }
  if (mood && Math.random() < 0.5) {
    const pool = isMenstrual || isLateLuteal ? ['sad', 'irritable', 'anxious', 'calm'] : ['happy', 'calm', 'energetic']
    rows.push({ user_id: user.id, tracker_id: mood.id, date, value: [pick(pool)] })
  }
  if (sleep && Math.random() < 0.55) {
    rows.push({ user_id: user.id, tracker_id: sleep.id, date, value: rand(11, 18) / 2 })
  }
}

console.log(`Upserting ${rows.length} log entries…`)
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await db.from('log_entries').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,tracker_id,date' })
  if (error) throw error
}

// --- recompute cycle_stats (mirrors src/lib/cycle.ts)
const lastStart = periodStarts[periodStarts.length - 1]
const cycleLens = periodStarts.slice(1).map((s, i) => Math.round((new Date(s) - new Date(periodStarts[i])) / 86400000)).slice(-6)
const avg = cycleLens.reduce((a, b) => a + b, 0) / cycleLens.length
const stddev = Math.sqrt(cycleLens.reduce((a, b) => a + (b - avg) ** 2, 0) / cycleLens.length)
const confidence = cycleLens.length >= 4 && stddev <= 2 ? 'high' : cycleLens.length >= 2 && stddev <= 5 ? 'medium' : 'low'
const windowDays = confidence === 'low' ? 4 : Math.min(5, Math.max(1, Math.round(stddev)))
const predicted = addDays(lastStart, Math.round(avg))
const ovulation = addDays(predicted, -14)
const { error: statsErr } = await db.from('cycle_stats').upsert({
  user_id: user.id,
  last_period_start: lastStart,
  avg_cycle_length: avg,
  cycle_length_stddev: stddev,
  avg_period_length: 5,
  predicted_next_start: predicted,
  prediction_window_days: windowDays,
  ovulation_date: ovulation,
  fertile_window_start: addDays(ovulation, confidence === 'low' ? -7 : -5),
  fertile_window_end: addDays(ovulation, confidence === 'low' ? 3 : 1),
  current_phase: 'follicular',
  cycle_day: Math.round((new Date(today) - new Date(lastStart)) / 86400000) + 1,
  confidence,
})
if (statsErr) throw statsErr

console.log(`Done. ${periodStarts.length} periods seeded, next predicted ${predicted} (±${windowDays}d, ${confidence}).`)
