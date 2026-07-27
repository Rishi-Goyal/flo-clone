import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { CalendarHeart, LogOut, Unlink } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { usePartnerLink } from '../hooks/useData'
import { supabase, todayIso } from '../lib/supabase'
import { liveFromRow, PHASE_EXPLAIN } from '../lib/statsRow'
import { pickTip } from '../lib/tips'
import { PhaseRing } from '../components/PhaseRing'
import { TipCard } from '../components/TipCard'
import { TrackerIcon } from '../components/TrackerIcon'
import { PHASE_UI } from '../components/phaseUi'
import { addDaysIso } from '../lib/cycle'
import type { CycleStatsRow, LogEntry, Tracker } from '../lib/types'

export function PartnerDashboard() {
  const { session, signOut } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const today = todayIso()

  const link = usePartnerLink(userId)
  const ownerId = link.data?.owner_id

  const ownerProfile = useQuery({
    queryKey: ['owner-profile', ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('display_name').eq('id', ownerId!).maybeSingle()
      return data
    },
  })

  const stats = useQuery({
    queryKey: ['owner-stats', ownerId],
    enabled: !!ownerId && !!link.data?.share_phase,
    queryFn: async () => {
      const { data, error } = await supabase.from('cycle_stats').select('*').eq('user_id', ownerId!).maybeSingle()
      if (error) throw error
      return (data as CycleStatsRow) ?? null
    },
  })

  const sharedTrackers = useQuery({
    queryKey: ['owner-trackers', ownerId],
    enabled: !!ownerId && !!link.data?.share_logs,
    queryFn: async () => {
      const { data } = await supabase.from('trackers').select('*').eq('user_id', ownerId!)
      return (data ?? []) as Tracker[]
    },
  })

  const recentEntries = useQuery({
    queryKey: ['owner-entries', ownerId],
    enabled: !!ownerId && !!link.data?.share_logs,
    queryFn: async () => {
      const { data } = await supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', ownerId!)
        .gte('date', addDaysIso(today, -6))
        .order('date', { ascending: false })
      return (data ?? []) as LogEntry[]
    },
  })

  // realtime: refresh when the owner logs flow or flips sharing switches
  useEffect(() => {
    if (!ownerId) return
    const channel = supabase
      .channel(`partner-live-${ownerId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cycle_stats', filter: `user_id=eq.${ownerId}` },
        () => void qc.invalidateQueries({ queryKey: ['owner-stats', ownerId] }),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'partner_links', filter: `owner_id=eq.${ownerId}` },
        () => {
          void qc.invalidateQueries({ queryKey: ['partner-link', userId] })
          void qc.invalidateQueries({ queryKey: ['owner-stats', ownerId] })
          void qc.invalidateQueries({ queryKey: ['owner-entries', ownerId] })
          void qc.invalidateQueries({ queryKey: ['owner-trackers', ownerId] })
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'log_entries', filter: `user_id=eq.${ownerId}` },
        () => void qc.invalidateQueries({ queryKey: ['owner-entries', ownerId] }),
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [ownerId, qc, userId])

  const live = useMemo(() => (stats.data ? liveFromRow(stats.data, today) : null), [stats.data, today])
  const tip = useMemo(
    () => (live && ownerId ? pickTip('partner', live, today, ownerId) : null),
    [live, ownerId, today],
  )

  const ownerName = ownerProfile.data?.display_name ?? 'your partner'
  const ui = live?.currentPhase ? PHASE_UI[live.currentPhase] : null

  function countdownText(): string | null {
    if (!link.data?.share_predictions || !live?.predictedNextStart || live.daysUntilPeriod === null) return null
    if (live.daysLate > 0)
      return `Period is ${live.daysLate} day${live.daysLate === 1 ? '' : 's'} later than predicted`
    const n = live.daysUntilPeriod
    const w = live.predictionWindowDays
    let text =
      live.confidence === 'high'
        ? `Period expected in ~${n} day${n === 1 ? '' : 's'}`
        : `Period expected in ${Math.max(0, n - w)}–${n + w} days`
    if (link.data.share_period_dates) {
      text += ` (around ${format(parseISO(live.predictedNextStart), 'd MMM')})`
    }
    return text
  }

  async function unlink() {
    if (!link.data) return
    if (!confirm(`Unlink from ${ownerName}? You'll lose access to their cycle info.`)) return
    await supabase.from('partner_links').update({ status: 'revoked' }).eq('id', link.data.id)
    await qc.invalidateQueries({ queryKey: ['partner-link', userId] })
  }

  if (link.isLoading) return null

  if (!link.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <CalendarHeart size={36} className="text-rose" />
        <p className="mt-3 text-sm font-semibold">Not linked yet</p>
        <p className="mt-1 max-w-xs text-xs leading-relaxed text-plum-soft">
          Ask your partner for an invite code (Settings → Partner in their app), then open the invite link
          — or sign out and go through onboarding again.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-5 flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-rose-dark shadow-sm"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-16 pt-6">
      <h1 className="text-xl font-bold">{ownerName}'s cycle</h1>
      <p className="text-xs text-plum-soft">Updates live as {ownerName} logs</p>

      {!link.data.share_phase ? (
        <div className="mt-6 rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold">Nothing shared right now</p>
          <p className="mt-1 text-xs text-plum-soft">{ownerName} has turned off cycle sharing.</p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-col items-center">
            <PhaseRing
              cycleDay={live?.cycleDay ?? null}
              avgCycleLength={live?.avgCycleLength ?? null}
              phase={live?.currentPhase ?? null}
            />
            {countdownText() && <p className="mt-2 text-sm font-medium text-plum-soft">{countdownText()}</p>}
          </div>

          {live?.currentPhase && ui && (
            <div className="mt-4 rounded-2xl p-4" style={{ background: ui.soft }}>
              <p className="text-sm font-bold" style={{ color: ui.text }}>
                {ui.label} phase
              </p>
              <p className="mt-1 text-xs leading-relaxed text-plum">{PHASE_EXPLAIN[live.currentPhase]}</p>
            </div>
          )}

          {tip && (
            <div className="mt-3">
              <TipCard tip={tip} title="How to support today" />
            </div>
          )}

          {link.data.share_logs && (recentEntries.data?.length ?? 0) > 0 && (
            <RecentLogs entries={recentEntries.data!} trackers={sharedTrackers.data ?? []} today={today} />
          )}
        </>
      )}

      <div className="mt-8 flex justify-center gap-3">
        <button
          type="button"
          onClick={() => void unlink()}
          className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-plum-soft shadow-sm"
        >
          <Unlink size={13} /> Unlink
        </button>
        <button
          type="button"
          onClick={() => void signOut()}
          className="flex items-center gap-1.5 rounded-2xl bg-white px-4 py-2.5 text-xs font-semibold text-plum-soft shadow-sm"
        >
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </div>
  )
}

function RecentLogs({ entries, trackers, today }: { entries: LogEntry[]; trackers: Tracker[]; today: string }) {
  const trackerById = new Map(trackers.map((t) => [t.id, t]))
  const byDate = new Map<string, LogEntry[]>()
  for (const e of entries) {
    if (!trackerById.has(e.tracker_id)) continue
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }
  const dates = [...byDate.keys()].sort().reverse()
  if (dates.length === 0) return null

  return (
    <div className="mt-5">
      <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-plum-soft">Recent days</h2>
      <div className="space-y-2">
        {dates.map((date) => (
          <div key={date} className="rounded-2xl bg-white p-3.5 shadow-sm">
            <p className="text-[11px] font-bold text-plum-soft">
              {date === today ? 'Today' : format(parseISO(date), 'EEE d MMM')}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {byDate.get(date)!.map((e) => {
                const t = trackerById.get(e.tracker_id)!
                return (
                  <span
                    key={e.id}
                    className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
                    style={{ background: `${t.color}1A`, color: t.color }}
                  >
                    <TrackerIcon name={t.icon} size={12} color={t.color} />
                    {t.name}
                    {formatValue(e, t) && <span className="opacity-80">· {formatValue(e, t)}</span>}
                  </span>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function formatValue(e: LogEntry, t: Tracker): string | null {
  const v = e.value
  if (v === true) return null
  if (Array.isArray(v)) {
    const labels = (t.config.options ?? []).filter((o) => v.includes(o.value)).map((o) => o.label)
    return labels.join(', ') || v.join(', ')
  }
  if (typeof v === 'number') return `${v}${t.config.unit ? ` ${t.config.unit}` : ''}`
  if (typeof v === 'string') {
    const opt = (t.config.options ?? []).find((o) => o.value === v)
    return opt?.label ?? v
  }
  return null
}
