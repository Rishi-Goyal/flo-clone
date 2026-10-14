import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import {
  markNoteRead,
  useAllEntries,
  useCategories,
  useDayEntries,
  useLinkedProfileName,
  useOwnerLink,
  useReminders,
  useSaveEntry,
  useTrackers,
  useUnreadNotes,
} from '../hooks/useData'
import { computeCycleSummary, addDaysIso, type CycleSummary } from '../lib/cycle'
import { pickTip } from '../lib/tips'
import { todayIso } from '../lib/supabase'
import { trackerSnapshot, updateWidget } from '../lib/widget'
import { PhaseRing } from '../components/PhaseRing'
import { TrackerInput } from '../components/TrackerInput'
import { MSymbol, TrackerIcon } from '../components/TrackerIcon'
import { PHASE_UI } from '../components/phaseUi'
import type { LogValue, PartnerNote, Reminder } from '../lib/types'
import { useQueryClient } from '@tanstack/react-query'

function expectedText(s: CycleSummary): string | null {
  if (!s.predictedNextStart) return null
  if (s.daysLate > 0) return `Period is ${s.daysLate} day${s.daysLate === 1 ? '' : 's'} late`
  const fmt = (iso: string) => format(parseISO(iso), 'd MMM')
  if (s.confidence === 'high') return `Period expected around ${fmt(s.predictedNextStart)}`
  const from = addDaysIso(s.predictedNextStart, -s.predictionWindowDays)
  const to = addDaysIso(s.predictedNextStart, s.predictionWindowDays)
  return `Period expected ${fmt(from)} – ${fmt(to)}`
}

export function Today() {
  const { session, profile } = useAuth()
  const userId = session?.user.id
  const today = todayIso()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? today
  const isToday = date === today
  const [showAll, setShowAll] = useState(false)

  const trackers = useTrackers(userId)
  const categories = useCategories(userId)
  const dayEntries = useDayEntries(userId, date)
  const allEntries = useAllEntries(userId)
  const reminders = useReminders(userId)
  const ownerLink = useOwnerLink(userId)
  const notes = useUnreadNotes(userId)
  const save = useSaveEntry(userId)

  const activeLink = ownerLink.data?.status === 'active' ? ownerLink.data : null
  const partnerName = useLinkedProfileName(activeLink?.partner_id)

  const flowTracker = trackers.data?.find((t) => t.system_key === 'period_flow')
  const summary = useMemo(() => {
    const flowDates = (allEntries.data ?? [])
      .filter((e) => e.tracker_id === flowTracker?.id)
      .map((e) => e.date)
    return computeCycleSummary(flowDates, today)
  }, [allEntries.data, flowTracker?.id, today])

  // keep the home-screen widget in sync (only once real data has loaded)
  useEffect(() => {
    if (allEntries.isSuccess && trackers.isSuccess) updateWidget(trackerSnapshot(summary))
  }, [summary, allEntries.isSuccess, trackers.isSuccess])

  const tip = useMemo(
    () => (userId ? pickTip('owner', summary, today, userId) : null),
    [summary, today, userId],
  )

  const valueByTracker = useMemo(() => {
    const map = new Map<string, LogValue>()
    for (const e of dayEntries.data ?? []) map.set(e.tracker_id, e.value)
    return map
  }, [dayEntries.data])

  const ui = summary.currentPhase ? PHASE_UI[summary.currentPhase] : PHASE_UI.menstrual
  const booleanTrackers = (trackers.data ?? []).filter((t) => t.is_active && t.input_type === 'boolean')
  const flowLogged = flowTracker ? valueByTracker.has(flowTracker.id) : false

  const greeting = (() => {
    const h = new Date().getHours()
    return h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening'
  })()

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      {/* header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[13px] font-medium text-plum-soft">{format(parseISO(date), 'EEEE, d MMMM')}</p>
          <h1 className="mt-1 font-display text-[30px] font-medium leading-tight tracking-[-.01em]">
            {isToday
              ? `${greeting}${profile?.display_name ? `, ${profile.display_name}` : ''}`
              : format(parseISO(date), 'd MMMM')}
          </h1>
        </div>
        <Link
          to="/settings"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush"
          aria-label="Settings"
        >
          <MSymbol name="account_circle" size={26} />
        </Link>
      </div>

      {!isToday && (
        <button
          type="button"
          onClick={() => setParams({})}
          className="mb-4 flex h-10 items-center gap-2 rounded-full bg-blush px-4 text-sm font-medium text-rose-deep"
        >
          <MSymbol name="arrow_back" size={18} />
          Editing a past day — back to today
        </button>
      )}

      {/* unread partner notes */}
      {isToday && (notes.data?.length ?? 0) > 0 && (
        <NoteBanners notes={notes.data!} senderName={partnerName.data ?? 'Your partner'} />
      )}

      {/* hero */}
      <div
        className="flex flex-col items-center gap-5 rounded-[28px] px-6 pb-6 pt-7"
        style={{ background: summary.currentPhase ? ui.hero : '#FBE9EE' }}
      >
        <PhaseRing cycleDay={summary.cycleDay} avgCycleLength={summary.avgCycleLength} phase={summary.currentPhase} />
        {isToday && tip && (
          <p className="max-w-[26ch] text-center text-[17px] leading-normal text-plum">{tip}</p>
        )}
        {expectedText(summary) && (
          <div className="flex items-center gap-2 rounded-full bg-white/70 px-4 py-2 text-sm font-medium text-ink-mute">
            <MSymbol name="calendar_month" size={18} />
            {expectedText(summary)}
          </div>
        )}
      </div>

      {/* reminders */}
      {isToday && <ReminderBanners reminders={reminders.data ?? []} today={today} />}

      {/* quick chips */}
      <div className="mt-4 rounded-[28px] border border-line bg-white px-5 py-6">
        <h2 className="font-display text-xl font-medium">
          {isToday ? "How's today feeling?" : `How was ${format(parseISO(date), 'EEEE')}?`}
        </h2>
        <p className="mt-1 text-sm text-plum-soft">Tap anything that fits. Nothing is required.</p>
        <div className="mt-4 flex flex-wrap gap-2.5">
          {booleanTrackers.map((t) => {
            const active = valueByTracker.get(t.id) === true
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => save.mutate({ trackerId: t.id, date, value: active ? null : true, isFlow: false })}
                className={`flex h-12 items-center gap-2 rounded-full px-5 text-[15px] font-medium transition-colors ${
                  active ? 'border border-transparent bg-rose text-white' : 'border border-line bg-white text-plum hover:bg-cream'
                }`}
              >
                <TrackerIcon name={t.icon} size={20} fill={active} color={active ? '#fff' : '#8A6B7D'} />
                {t.name}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex h-12 items-center gap-2 rounded-full border border-dashed border-blush-deep px-5 text-[15px] font-medium text-plum-soft hover:bg-cream"
          >
            <MSymbol name={showAll ? 'remove' : 'add'} size={20} />
            {showAll ? 'Less' : 'More'}
          </button>
        </div>
      </div>

      {/* period button */}
      {flowTracker && (
        <button
          type="button"
          onClick={() =>
            save.mutate({
              trackerId: flowTracker.id,
              date,
              value: flowLogged ? null : 'medium',
              isFlow: true,
            })
          }
          className={`mt-3 flex h-14 w-full items-center justify-center gap-2.5 rounded-full font-display text-base font-semibold transition-colors ${
            flowLogged ? 'bg-rose text-white' : 'bg-blush text-rose-dark hover:bg-blush-deep'
          }`}
        >
          <MSymbol name={flowLogged ? 'check' : 'water_drop'} size={22} fill={flowLogged} />
          {flowLogged ? 'Period logged — tap to undo' : isToday ? 'My period started' : 'Period on this day'}
        </button>
      )}

      {/* full tracker list */}
      {showAll && (
        <div className="mt-5 space-y-5">
          {(categories.data ?? []).map((cat) => {
            const list = (trackers.data ?? []).filter(
              (t) => t.category_id === cat.id && t.is_active && t.input_type !== 'boolean' && t.system_key !== 'period_flow',
            )
            if (list.length === 0) return null
            return (
              <section key={cat.id}>
                <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[.03em] text-plum-soft">
                  {cat.name}
                </h3>
                <div className="space-y-2.5">
                  {list.map((t) => (
                    <TrackerInput
                      key={t.id}
                      tracker={t}
                      value={valueByTracker.get(t.id) ?? null}
                      onChange={(value) => save.mutate({ trackerId: t.id, date, value, isFlow: false })}
                    />
                  ))}
                </div>
              </section>
            )
          })}
          {flowTracker && (
            <TrackerInput
              tracker={flowTracker}
              value={valueByTracker.get(flowTracker.id) ?? null}
              onChange={(value) => save.mutate({ trackerId: flowTracker.id, date, value, isFlow: true })}
            />
          )}
        </div>
      )}

      {/* partner can see */}
      {activeLink && (
        <div className="mt-6">
          <p className="mb-2 ml-1 text-[13px] font-semibold text-plum-soft">
            {partnerName.data ?? 'Your partner'} can see
          </p>
          <Link
            to="/settings/sharing"
            className="flex items-center gap-3.5 rounded-[20px] border border-line bg-white px-4.5 py-4"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-fertile-soft font-display text-base font-semibold text-fertile-deep">
              {(partnerName.data ?? 'P')[0].toUpperCase()}
            </span>
            <p className="flex-1 text-sm leading-normal text-ink-soft">{shareSummary(activeLink)}</p>
            <MSymbol name="chevron_right" size={20} color="#8A6B7D" />
          </Link>
        </div>
      )}

      {trackers.isSuccess && (trackers.data?.length ?? 0) === 0 && (
        <p className="mt-8 text-center text-sm text-plum-soft">
          No trackers yet — add some in Settings → What I track.
        </p>
      )}
    </div>
  )
}

function shareSummary(link: { share_phase: boolean; share_predictions: boolean; share_logs: boolean; share_notes: boolean }): string {
  if (!link.share_phase) return 'Nothing right now — sharing is off.'
  const parts = ['Your phase and today’s tip']
  if (link.share_predictions) parts.push('predictions')
  if (link.share_logs) parts.push('shared symptoms')
  return `${parts.join(', ')}. ${link.share_notes ? '' : 'Not your notes.'}`.trim()
}

function NoteBanners({ notes, senderName }: { notes: PartnerNote[]; senderName: string }) {
  const qc = useQueryClient()
  return (
    <div className="mb-4 space-y-2">
      {notes.slice(0, 3).map((n) => (
        <div key={n.id} className="flex items-start gap-3.5 rounded-[20px] bg-fertile-soft p-4">
          <MSymbol name="favorite" size={20} fill color="#2F6D59" className="mt-0.5 shrink-0" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold uppercase tracking-[.03em] text-fertile-deep">
              Note from {senderName}
            </p>
            <p className="mt-1 text-[15px] leading-normal text-mint-ink">{n.body}</p>
          </div>
          <button
            type="button"
            aria-label="Dismiss note"
            className="flex h-9 w-9 items-center justify-center rounded-full text-fertile-deep hover:bg-white/60"
            onClick={async () => {
              await markNoteRead(n.id)
              await qc.invalidateQueries({ queryKey: ['notes-unread'] })
            }}
          >
            <MSymbol name="close" size={18} />
          </button>
        </div>
      ))}
    </div>
  )
}

function ReminderBanners({ reminders, today }: { reminders: Reminder[]; today: string }) {
  const [, force] = useState(0)
  const dow = new Date().getDay()
  const due = reminders.filter(
    (r) => r.active && r.days_of_week.includes(dow) && !localStorage.getItem(`reminder-done-${r.id}-${today}`),
  )
  if (due.length === 0) return null
  return (
    <div className="mt-4 space-y-2">
      {due.map((r) => (
        <div key={r.id} className="flex items-center gap-3.5 rounded-[20px] bg-luteal-soft p-4">
          <MSymbol name="notifications" size={20} color="#6E51A0" className="shrink-0" />
          <div className="flex-1">
            <p className="text-[15px] font-semibold">{r.title}</p>
            <p className="text-xs text-plum-soft">{r.time_of_day.slice(0, 5)}</p>
          </div>
          <button
            type="button"
            aria-label="Done for today"
            className="flex h-9 w-9 items-center justify-center rounded-full text-luteal-deep hover:bg-white/60"
            onClick={() => {
              localStorage.setItem(`reminder-done-${r.id}-${today}`, '1')
              force((n) => n + 1)
            }}
          >
            <MSymbol name="check" size={18} />
          </button>
        </div>
      ))}
    </div>
  )
}
