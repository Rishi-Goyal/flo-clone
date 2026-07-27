import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { BellRing, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useAllEntries, useCategories, useDayEntries, useReminders, useSaveEntry, useTrackers } from '../hooks/useData'
import { computeCycleSummary, addDaysIso } from '../lib/cycle'
import { pickTip } from '../lib/tips'
import { todayIso } from '../lib/supabase'
import { PhaseRing } from '../components/PhaseRing'
import { TipCard } from '../components/TipCard'
import { TrackerInput } from '../components/TrackerInput'
import type { LogValue } from '../lib/types'
import { useState } from 'react'

export function Today() {
  const { session, profile } = useAuth()
  const userId = session?.user.id
  const today = todayIso()
  const [params, setParams] = useSearchParams()
  const date = params.get('date') ?? today

  const trackers = useTrackers(userId)
  const categories = useCategories(userId)
  const dayEntries = useDayEntries(userId, date)
  const allEntries = useAllEntries(userId)
  const reminders = useReminders(userId)
  const save = useSaveEntry(userId)

  const flowTracker = trackers.data?.find((t) => t.system_key === 'period_flow')
  const summary = useMemo(() => {
    const flowDates = (allEntries.data ?? [])
      .filter((e) => e.tracker_id === flowTracker?.id)
      .map((e) => e.date)
    return computeCycleSummary(flowDates, today)
  }, [allEntries.data, flowTracker?.id, today])

  const tip = useMemo(
    () => (userId ? pickTip('owner', summary, today, userId) : null),
    [summary, today, userId],
  )

  const valueByTracker = useMemo(() => {
    const map = new Map<string, LogValue>()
    for (const e of dayEntries.data ?? []) map.set(e.tracker_id, e.value)
    return map
  }, [dayEntries.data])

  const isToday = date === today

  function statusLine(): string | null {
    if (!summary.predictedNextStart) return null
    if (summary.daysLate > 0) return `Period is ${summary.daysLate} day${summary.daysLate === 1 ? '' : 's'} late`
    if (summary.daysUntilPeriod !== null && summary.daysUntilPeriod >= 0) {
      const from = Math.max(0, summary.daysUntilPeriod - summary.predictionWindowDays)
      const to = summary.daysUntilPeriod + summary.predictionWindowDays
      if (summary.confidence === 'high') return `Period in ~${summary.daysUntilPeriod} days`
      return `Period expected in ${from}–${to} days`
    }
    return null
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      {/* date nav */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          className="rounded-full p-2 text-plum-soft hover:bg-blush"
          onClick={() => setParams({ date: addDaysIso(date, -1) })}
          aria-label="Previous day"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-sm font-bold">
            {isToday ? `Hi${profile?.display_name ? ` ${profile.display_name}` : ''} 👋` : format(parseISO(date), 'EEEE')}
          </p>
          <p className="text-xs text-plum-soft">{format(parseISO(date), 'd MMMM yyyy')}</p>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-plum-soft hover:bg-blush disabled:opacity-30"
          onClick={() => setParams({ date: addDaysIso(date, 1) })}
          disabled={date >= today}
          aria-label="Next day"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {/* phase ring (always reflects today, not the browsed date) */}
      <div className="mt-4 flex flex-col items-center">
        <PhaseRing
          cycleDay={summary.cycleDay}
          avgCycleLength={summary.avgCycleLength}
          phase={summary.currentPhase}
        />
        {statusLine() && <p className="mt-2 text-sm font-medium text-plum-soft">{statusLine()}</p>}
      </div>

      {/* reminders */}
      {isToday && <ReminderBanners reminders={reminders.data ?? []} today={today} />}

      {/* tip */}
      {isToday && tip && (
        <div className="mt-4">
          <TipCard tip={tip} />
        </div>
      )}

      {/* trackers grouped by category */}
      <div className="mt-5 space-y-5">
        {(categories.data ?? []).map((cat) => {
          const list = (trackers.data ?? []).filter((t) => t.category_id === cat.id && t.is_active)
          if (list.length === 0) return null
          return (
            <section key={cat.id}>
              <h2 className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-plum-soft">
                {cat.name}
              </h2>
              <div className="space-y-2.5">
                {list.map((t) => (
                  <TrackerInput
                    key={t.id}
                    tracker={t}
                    value={valueByTracker.get(t.id) ?? null}
                    onChange={(value) =>
                      save.mutate({ trackerId: t.id, date, value, isFlow: t.system_key === 'period_flow' })
                    }
                  />
                ))}
              </div>
            </section>
          )
        })}
        {/* trackers without a category */}
        {(trackers.data ?? []).filter((t) => !t.category_id && t.is_active).map((t) => (
          <TrackerInput
            key={t.id}
            tracker={t}
            value={valueByTracker.get(t.id) ?? null}
            onChange={(value) =>
              save.mutate({ trackerId: t.id, date, value, isFlow: t.system_key === 'period_flow' })
            }
          />
        ))}
      </div>

      {trackers.isSuccess && (trackers.data?.length ?? 0) === 0 && (
        <p className="mt-8 text-center text-sm text-plum-soft">
          No trackers yet — add some in Settings → Trackers.
        </p>
      )}
    </div>
  )
}

function ReminderBanners({ reminders, today }: { reminders: import('../lib/types').Reminder[]; today: string }) {
  const [, force] = useState(0)
  const dow = new Date().getDay()
  const due = reminders.filter(
    (r) => r.active && r.days_of_week.includes(dow) && !localStorage.getItem(`reminder-done-${r.id}-${today}`),
  )
  if (due.length === 0) return null
  return (
    <div className="mt-4 space-y-2">
      {due.map((r) => (
        <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-luteal-soft p-3.5">
          <BellRing size={18} className="shrink-0 text-luteal" />
          <div className="flex-1">
            <p className="text-sm font-semibold">{r.title}</p>
            <p className="text-[11px] text-plum-soft">{r.time_of_day.slice(0, 5)}</p>
          </div>
          <button
            type="button"
            aria-label="Done for today"
            className="rounded-full p-1.5 text-plum-soft hover:bg-white/60"
            onClick={() => {
              localStorage.setItem(`reminder-done-${r.id}-${today}`, '1')
              force((n) => n + 1)
            }}
          >
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
