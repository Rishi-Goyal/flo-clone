import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useLinkedProfileName, usePartnerLink, useSendNote } from '../hooks/useData'
import { supabase, todayIso } from '../lib/supabase'
import { liveFromRow, PHASE_EXPLAIN } from '../lib/statsRow'
import { pickTip } from '../lib/tips'
import { MSymbol, TrackerIcon } from '../components/TrackerIcon'
import { PHASE_UI } from '../components/phaseUi'
import { addDaysIso } from '../lib/cycle'
import type { CycleStatsRow, LogEntry, Tracker } from '../lib/types'

export function PartnerDashboard() {
  const { session, signOut } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const today = todayIso()
  const [menuOpen, setMenuOpen] = useState(false)

  const link = usePartnerLink(userId)
  const ownerId = link.data?.owner_id
  const ownerName = useLinkedProfileName(ownerId)

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

  const name = ownerName.data ?? 'Your partner'
  const ui = live?.currentPhase ? PHASE_UI[live.currentPhase] : null

  function expectedLine(): string | null {
    if (!link.data?.share_predictions || !live?.predictedNextStart || live.daysUntilPeriod === null) return null
    if (live.daysLate > 0)
      return `Period is ${live.daysLate} day${live.daysLate === 1 ? '' : 's'} later than predicted`
    const n = live.daysUntilPeriod
    const w = live.predictionWindowDays
    if (link.data.share_period_dates)
      return `Period expected around ${format(parseISO(live.predictedNextStart), 'd MMM')}`
    return live.confidence === 'high'
      ? `Period expected in ~${n} day${n === 1 ? '' : 's'}`
      : `Period expected in ${Math.max(0, n - w)}–${n + w} days`
  }

  async function unlink() {
    if (!link.data) return
    if (!confirm(`Unlink from ${name}? You'll lose access to their cycle info.`)) return
    await supabase.from('partner_links').update({ status: 'revoked' }).eq('id', link.data.id)
    await qc.invalidateQueries({ queryKey: ['partner-link', userId] })
  }

  if (link.isLoading) return null

  if (!link.data) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-mint-bg px-6 text-center text-mint-ink">
        <MSymbol name="favorite" size={36} fill color="#6FB5A2" />
        <p className="mt-3 text-[15px] font-semibold">Not linked yet</p>
        <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-mint-soft">
          Ask your partner for an invite code (Settings → Partner in their app), then open the invite link
          — or sign out and go through onboarding again.
        </p>
        <button
          type="button"
          onClick={() => void signOut()}
          className="mt-6 flex h-12 items-center gap-2 rounded-full border border-mint-line bg-white px-6 text-sm font-semibold text-fertile-deep"
        >
          <MSymbol name="logout" size={18} /> Sign out
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-mint-bg text-mint-ink">
      <div className="mx-auto max-w-md px-5 pb-16 pt-5">
        {/* header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-[13px] font-medium text-mint-soft">{format(parseISO(today), 'EEEE, d MMMM')}</p>
            <h1 className="mt-1 font-display text-[30px] font-medium leading-tight tracking-[-.01em]">
              {name} today
            </h1>
          </div>
          <button
            type="button"
            aria-label="Options"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#3E6459] hover:bg-white/70"
          >
            <MSymbol name="settings" size={24} />
          </button>
        </div>

        {menuOpen && (
          <div className="mb-4 flex gap-2.5">
            <button
              type="button"
              onClick={() => void unlink()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-mint-line bg-white text-sm font-semibold text-mint-soft"
            >
              <MSymbol name="link_off" size={16} /> Unlink
            </button>
            <button
              type="button"
              onClick={() => void signOut()}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-full border border-mint-line bg-white text-sm font-semibold text-mint-soft"
            >
              <MSymbol name="logout" size={16} /> Sign out
            </button>
          </div>
        )}

        {!link.data.share_phase ? (
          <div className="rounded-[28px] border border-mint-line bg-white p-6 text-center">
            <p className="text-[15px] font-semibold">Nothing shared right now</p>
            <p className="mt-1.5 text-sm text-mint-soft">{name} has turned off cycle sharing.</p>
          </div>
        ) : (
          <>
            {/* phase card */}
            <div className="flex flex-col items-center gap-4 rounded-[28px] border border-mint-line bg-white px-6 py-7">
              {live?.currentPhase && ui ? (
                <>
                  <span
                    className="flex h-8 items-center gap-2 rounded-full px-3.5 text-sm font-semibold"
                    style={{ background: ui.soft, color: ui.text }}
                  >
                    <i className="h-2 w-2 rounded-full" style={{ background: ui.color }} />
                    {ui.label} phase · day {live.cycleDay}
                  </span>
                  <p className="max-w-[20ch] text-center font-display text-[24px] font-normal leading-snug tracking-[-.01em]">
                    {PHASE_EXPLAIN[live.currentPhase]}
                  </p>
                </>
              ) : (
                <p className="text-sm text-mint-soft">No cycle data yet — predictions appear once {name} logs a period.</p>
              )}
              {expectedLine() && (
                <div className="flex items-center gap-2 text-sm text-mint-soft">
                  <MSymbol name="calendar_month" size={18} />
                  {expectedLine()}
                </div>
              )}
            </div>

            {/* one thing today */}
            {tip && (
              <OneThingToday
                tip={tip}
                linkId={link.data.id}
                senderId={userId!}
                recipientId={link.data.owner_id}
                ownerName={name}
              />
            )}

            {/* how she's been */}
            {link.data.share_logs && (
              <RecentDays
                entries={recentEntries.data ?? []}
                trackers={sharedTrackers.data ?? []}
                today={today}
                ownerName={name}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function OneThingToday({
  tip,
  linkId,
  senderId,
  recipientId,
  ownerName,
}: {
  tip: string
  linkId: string
  senderId: string
  recipientId: string
  ownerName: string
}) {
  const [composing, setComposing] = useState(false)
  const [body, setBody] = useState('')
  const [sent, setSent] = useState(false)
  const send = useSendNote()

  async function submit() {
    if (!body.trim()) return
    await send.mutateAsync({ linkId, senderId, recipientId, body })
    setBody('')
    setComposing(false)
    setSent(true)
    setTimeout(() => setSent(false), 3000)
  }

  return (
    <div className="mt-4 rounded-[28px] bg-fertile-soft p-6">
      <p className="text-[13px] font-bold uppercase tracking-[.06em] text-fertile-deep/90">One thing today</p>
      <p className="mt-2.5 font-display text-[22px] font-normal leading-normal">{tip}</p>

      {composing ? (
        <div className="mt-5">
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, 500))}
            placeholder={`A quick note for ${ownerName}…`}
            rows={3}
            className="w-full resize-none rounded-3xl border border-mint-line bg-white p-4 text-[15px] text-mint-ink outline-none placeholder:text-mint-soft/70"
          />
          <div className="mt-2.5 flex gap-2.5">
            <button
              type="button"
              onClick={() => setComposing(false)}
              className="h-12 flex-1 rounded-full border border-[#B9DCD0] text-sm font-semibold text-fertile-deep"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={send.isPending || !body.trim()}
              onClick={() => void submit()}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-fertile-deep text-sm font-semibold text-white disabled:opacity-50"
            >
              <MSymbol name="send" size={18} />
              {send.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
          {send.isError && <p className="mt-2 text-xs text-rose-dark">Couldn't send — try again.</p>}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setComposing(true)}
          className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-fertile-deep text-[15px] font-semibold text-white"
        >
          <MSymbol name={sent ? 'check' : 'send'} size={20} />
          {sent ? 'Sent — they’ll see it on their Today screen' : 'Send a note'}
        </button>
      )}
    </div>
  )
}

function RecentDays({
  entries,
  trackers,
  today,
  ownerName,
}: {
  entries: LogEntry[]
  trackers: Tracker[]
  today: string
  ownerName: string
}) {
  const trackerById = new Map(trackers.map((t) => [t.id, t]))
  const byDate = new Map<string, LogEntry[]>()
  for (const e of entries) {
    if (!trackerById.has(e.tracker_id)) continue
    const list = byDate.get(e.date) ?? []
    list.push(e)
    byDate.set(e.date, list)
  }
  const days = [0, -1, -2, -3].map((off) => addDaysIso(today, off))

  return (
    <div className="mt-6">
      <p className="mb-2.5 ml-1 text-[13px] font-semibold text-mint-soft">How they've been</p>
      <div className="overflow-hidden rounded-[24px] border border-mint-line bg-white">
        {days.map((date, i) => {
          const list = byDate.get(date) ?? []
          return (
            <div key={date} className={`flex items-center gap-3.5 px-5 py-[18px] ${i > 0 ? 'border-t border-[#EAF2EE]' : ''}`}>
              <span className="w-11 text-center text-[13px] font-semibold text-mint-soft">
                {date === today ? 'Today' : format(parseISO(date), 'EEE')}
              </span>
              {list.length > 0 ? (
                <div className="flex flex-1 flex-wrap gap-2">
                  {list.map((e) => {
                    const t = trackerById.get(e.tracker_id)!
                    const v = formatValue(e, t)
                    return (
                      <span
                        key={e.id}
                        className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium"
                        style={{ background: `${t.color}1A`, color: t.color }}
                      >
                        <TrackerIcon name={t.icon} size={15} color={t.color} />
                        {t.name}
                        {v && <span className="opacity-80">· {v}</span>}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <span className="flex-1 text-sm text-[#8AA49B]">Nothing logged</span>
              )}
            </div>
          )
        })}
      </div>
      <p className="mx-1 mt-3 text-[13px] leading-relaxed text-[#7D958C]">
        {ownerName} chooses what appears here. You'll never see their notes.
      </p>
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
