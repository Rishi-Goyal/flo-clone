// Dev/test sign-in helper. Creates two test accounts (tracker@bloom.test and
// partner@bloom.test), seeds the tracker with data, links them as a couple,
// then prints one-time sign-in URLs handled by the DEV-only /dev-login route.
//
//   node scripts/dev-login.mjs          # ensure fixtures + print sign-in URLs
//   node scripts/dev-login.mjs --reseed # also regenerate log entries
//
// Requires VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
// Test users are throwaway fixtures — never use real emails here.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = {}
for (const line of readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}
const { VITE_SUPABASE_URL: URL_, SUPABASE_SERVICE_ROLE_KEY: KEY } = env
if (!URL_ || !KEY) {
  console.error('Need VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = createClient(URL_, KEY)

const TRACKER = { email: 'tracker@bloom.test', name: 'Testy', role: 'tracker' }
const PARTNER = { email: 'partner@bloom.test', name: 'Pat', role: 'partner' }
const APP = 'http://localhost:5173'

const iso = (d) => d.toISOString().slice(0, 10)
const addDays = (isoDate, n) => {
  const d = new Date(isoDate + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return iso(d)
}
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1))

async function ensureUser({ email, name, role }) {
  const { data: list, error } = await db.auth.admin.listUsers({ perPage: 1000 })
  if (error) throw error
  let user = list.users.find((u) => u.email === email)
  if (!user) {
    const { data, error: err } = await db.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { display_name: name },
    })
    if (err) throw err
    user = data.user
    console.log(`created ${email}`)
  }
  await db.from('profiles').update({ display_name: name, role }).eq('id', user.id)
  return user
}

const DEFAULTS = [
  { cat: 'Body', name: 'Period flow', icon: 'Droplets', color: '#E4557F', input_type: 'choice', system_key: 'period_flow', shared: true,
    config: { options: [{ value: 'spotting', label: 'Spotting' }, { value: 'light', label: 'Light' }, { value: 'medium', label: 'Medium' }, { value: 'heavy', label: 'Heavy' }] } },
  { cat: 'Body', name: 'Cramps', icon: 'Zap', color: '#E8743D', input_type: 'boolean', config: {}, shared: true },
  { cat: 'Body', name: 'Headache', icon: 'Brain', color: '#9B7EC4', input_type: 'boolean', config: {} },
  { cat: 'Mood & energy', name: 'Mood', icon: 'Smile', color: '#E8A33D', input_type: 'multichoice', shared: true,
    config: { options: [{ value: 'happy', label: 'Happy' }, { value: 'calm', label: 'Calm' }, { value: 'sad', label: 'Sad' }, { value: 'irritable', label: 'Irritable' }] } },
  { cat: 'Mood & energy', name: 'Energy', icon: 'BatteryMedium', color: '#6FB5A2', input_type: 'scale', shared: true,
    config: { min: 1, max: 5, min_label: 'Drained', max_label: 'Full' } },
  { cat: 'Lifestyle', name: 'Sleep', icon: 'Moon', color: '#9B7EC4', input_type: 'number', config: { unit: 'h' } },
  { cat: 'Lifestyle', name: 'Notes', icon: 'NotebookPen', color: '#8A6B7D', input_type: 'text', config: {} },
]

async function ensureTrackers(userId) {
  const { data: existing } = await db.from('trackers').select('id, system_key, name').eq('user_id', userId)
  if (existing?.length) return existing
  const catNames = [...new Set(DEFAULTS.map((d) => d.cat))]
  const catIds = {}
  for (let i = 0; i < catNames.length; i++) {
    const { data, error } = await db
      .from('tracker_categories')
      .insert({ user_id: userId, name: catNames[i], sort_order: i })
      .select()
      .single()
    if (error) throw error
    catIds[catNames[i]] = data.id
  }
  const rows = DEFAULTS.map((d, i) => ({
    user_id: userId,
    category_id: catIds[d.cat],
    name: d.name,
    icon: d.icon,
    color: d.color,
    input_type: d.input_type,
    config: d.config,
    sort_order: i,
    system_key: d.system_key ?? null,
    shared_with_partner: d.shared ?? false,
  }))
  const { data, error } = await db.from('trackers').insert(rows).select()
  if (error) throw error
  console.log('seeded default trackers')
  return data
}

async function seedEntries(userId, trackers) {
  const flow = trackers.find((t) => t.system_key === 'period_flow')
  const byName = Object.fromEntries(trackers.map((t) => [t.name, t]))
  const today = iso(new Date())
  const starts = []
  let cursor = addDays(today, -160)
  while (cursor < addDays(today, -12)) {
    starts.push(cursor)
    cursor = addDays(cursor, rand(27, 31))
  }
  const rows = []
  const flowVals = ['medium', 'heavy', 'medium', 'light', 'spotting']
  for (const start of starts) {
    for (let d = 0; d < rand(4, 5); d++)
      rows.push({ user_id: userId, tracker_id: flow.id, date: addDays(start, d), value: flowVals[Math.min(d, 4)] })
    for (const off of [-2, -1]) {
      if (byName['Cramps'] && Math.random() < 0.85)
        rows.push({ user_id: userId, tracker_id: byName['Cramps'].id, date: addDays(start, off), value: true })
    }
  }
  const totalDays = 160
  const first = starts[0]
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(first, i)
    if (date > today) break
    if (byName['Energy'] && Math.random() < 0.55)
      rows.push({ user_id: userId, tracker_id: byName['Energy'].id, date, value: rand(1, 5) })
    if (byName['Sleep'] && Math.random() < 0.4)
      rows.push({ user_id: userId, tracker_id: byName['Sleep'].id, date, value: rand(11, 17) / 2 })
    if (byName['Mood'] && Math.random() < 0.4)
      rows.push({ user_id: userId, tracker_id: byName['Mood'].id, date, value: [['happy', 'calm', 'sad', 'irritable'][rand(0, 3)]] })
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from('log_entries').upsert(rows.slice(i, i + 500), { onConflict: 'user_id,tracker_id,date' })
    if (error) throw error
  }
  // cycle_stats
  const lens = starts.slice(1).map((s, i) => Math.round((new Date(s) - new Date(starts[i])) / 86400000)).slice(-6)
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - avg) ** 2, 0) / lens.length)
  const conf = lens.length >= 4 && sd <= 2 ? 'high' : lens.length >= 2 && sd <= 5 ? 'medium' : 'low'
  const win = conf === 'low' ? 4 : Math.min(5, Math.max(1, Math.round(sd)))
  const last = starts[starts.length - 1]
  const next = addDays(last, Math.round(avg))
  const ov = addDays(next, -14)
  await db.from('cycle_stats').upsert({
    user_id: userId,
    last_period_start: last,
    avg_cycle_length: avg,
    cycle_length_stddev: sd,
    avg_period_length: 4.5,
    predicted_next_start: next,
    prediction_window_days: win,
    ovulation_date: ov,
    fertile_window_start: addDays(ov, conf === 'low' ? -7 : -5),
    fertile_window_end: addDays(ov, conf === 'low' ? 3 : 1),
    current_phase: 'follicular',
    cycle_day: Math.round((new Date(today) - new Date(last)) / 86400000) + 1,
    confidence: conf,
  })
  console.log(`seeded ${rows.length} entries, ${starts.length} periods, next ${next} (${conf})`)
}

async function ensureLink(ownerId, partnerId) {
  const { data: existing } = await db
    .from('partner_links')
    .select('*')
    .eq('owner_id', ownerId)
    .neq('status', 'revoked')
    .maybeSingle()
  if (existing) {
    if (existing.status !== 'active' || existing.partner_id !== partnerId) {
      await db
        .from('partner_links')
        .update({ partner_id: partnerId, status: 'active', accepted_at: new Date().toISOString(), share_logs: true })
        .eq('id', existing.id)
    }
    return
  }
  const { error } = await db.from('partner_links').insert({
    owner_id: ownerId,
    partner_id: partnerId,
    status: 'active',
    accepted_at: new Date().toISOString(),
    share_phase: true,
    share_predictions: true,
    share_period_dates: true,
    share_logs: true,
  })
  if (error) throw error
  console.log('linked accounts')
}

async function loginUrl(email, label) {
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  return `${APP}/dev-login?token_hash=${data.properties.hashed_token}&as=${label}`
}

const tracker = await ensureUser(TRACKER)
const partner = await ensureUser(PARTNER)
const trackers = await ensureTrackers(tracker.id)
const { data: flowEntries } = await db.from('log_entries').select('id').eq('user_id', tracker.id).limit(1)
if (!flowEntries?.length || process.argv.includes('--reseed')) await seedEntries(tracker.id, trackers)
await ensureLink(tracker.id, partner.id)

console.log('\nSign-in URLs (valid ~1 hour, single use — rerun to mint fresh ones):')
console.log('  tracker:', await loginUrl(TRACKER.email, 'tracker'))
console.log('  partner:', await loginUrl(PARTNER.email, 'partner'))
