import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useAllEntries, useTrackers } from '../hooks/useData'
import { computeCycleSummary, addDaysIso, type CycleSummary } from '../lib/cycle'
import { computePatternInsights } from '../lib/insights'
import { todayIso } from '../lib/supabase'
import { CalendarMonth } from '../components/CalendarMonth'
import { PHASE_UI } from '../components/phaseUi'

function headline(s: CycleSummary): string {
  if (!s.predictedNextStart) return 'Log a period to see predictions'
  if (s.daysLate > 0) return `${s.daysLate} day${s.daysLate === 1 ? '' : 's'} later than predicted`
  if (s.confidence === 'high') return `Around ${format(parseISO(s.predictedNextStart), 'EEEE d MMMM')}`
  const from = addDaysIso(s.predictedNextStart, -s.predictionWindowDays)
  const to = addDaysIso(s.predictedNextStart, s.predictionWindowDays)
  return `${format(parseISO(from), 'd')} – ${format(parseISO(to), 'd MMMM')}`
}

function friendly(s: CycleSummary): string {
  if (!s.predictedNextStart) return 'Once you log a period, predictions and the fertile estimate appear here.'
  if (s.daysLate > 0) return 'Cycles drift — stress, travel and sleep all move them. Log it when it arrives and predictions adjust.'
  if (s.confidence === 'high')
    return `Your last ${s.validCycleLengths.length} cycles have been steady, so this one's a good guess.`
  if (s.confidence === 'medium') return 'Your cycles vary a little, so treat this as a window rather than a date.'
  return 'Still learning your rhythm — predictions get sharper after a few logged cycles.'
}

export function CalendarPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => new Date())

  const trackers = useTrackers(userId)
  const allEntries = useAllEntries(userId)
  const flowTracker = trackers.data?.find((t) => t.system_key === 'period_flow')

  const { summary, loggedFlowDates, patterns } = useMemo(() => {
    const entries = allEntries.data ?? []
    const flowDates = entries.filter((e) => e.tracker_id === flowTracker?.id).map((e) => e.date)
    const s = computeCycleSummary(flowDates, todayIso())
    const nonFlow = entries
      .filter((e) => e.tracker_id !== flowTracker?.id)
      .map((e) => ({ trackerId: e.tracker_id, date: e.date, value: e.value }))
    return { summary: s, loggedFlowDates: new Set(flowDates), patterns: computePatternInsights(s.periods, nonFlow) }
  }, [allEntries.data, flowTracker?.id])

  const trackerById = new Map((trackers.data ?? []).map((t) => [t.id, t]))
  const ui = summary.currentPhase ? PHASE_UI[summary.currentPhase] : PHASE_UI.menstrual

  const nextPeriodCard = (
    <div className="rounded-[28px] border border-line bg-white p-6">
      <p className="text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">Next period</p>
      <p className="mt-2 font-display text-[26px] leading-snug">{headline(summary)}</p>
      <p className="mt-2.5 text-[15px] leading-relaxed text-ink-mute">{friendly(summary)}</p>
      <p className="mt-4 text-[13px] leading-relaxed text-plum-soft/90">
        Fertile days are calendar estimates — not reliable for contraception.
      </p>
    </div>
  )

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10 lg:max-w-5xl">
      <h1 className="mb-5 font-display text-[28px] font-medium tracking-[-.01em]">Calendar</h1>

      <div className="lg:grid lg:grid-cols-[1.4fr_1fr] lg:items-start lg:gap-7">
        <div className="rounded-[28px] border border-line bg-white p-6">
          <CalendarMonth
            month={month}
            onMonthChange={setMonth}
            summary={summary}
            loggedFlowDates={loggedFlowDates}
            onSelectDate={(iso) => {
              if (iso <= todayIso()) navigate(iso === todayIso() ? '/today' : `/today?date=${iso}`)
            }}
            cellSize={40}
          />
        </div>

        <div className="mt-4 flex flex-col gap-4 lg:mt-0">
          {/* phase tip card (desktop parity with the design's right rail) */}
          {summary.currentPhase && (
            <div className="hidden rounded-[28px] p-7 lg:block" style={{ background: ui.hero }}>
              <p className="font-display text-[22px] leading-normal text-plum">
                Day {summary.cycleDay} · {ui.label} phase
              </p>
              {summary.predictedNextStart && (
                <p className="mt-3 text-[15px] text-ink-mute">
                  Next period {headline(summary).charAt(0).toLowerCase() + headline(summary).slice(1)}
                </p>
              )}
            </div>
          )}

          {nextPeriodCard}

          {patterns.length > 0 && (
            <div className="hidden rounded-[28px] border border-line bg-white p-7 lg:block">
              <p className="mb-4 text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">Patterns</p>
              <div className="flex flex-col gap-4">
                {patterns.slice(0, 3).map((p, i) => {
                  const t = trackerById.get(p.trackerId)
                  if (!t) return null
                  return (
                    <div key={p.trackerId} className={i > 0 ? 'border-t border-line-soft pt-4' : ''}>
                      <p className="text-[17px] leading-normal">{p.text(t.name)}</p>
                      <p className="mt-1.5 text-[13px] text-plum-soft">
                        {p.cyclesWithSignal} of {p.totalCycles} cycles
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
