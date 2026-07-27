import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { useAuth } from '../hooks/useAuth'
import { useAllEntries, useTrackers } from '../hooks/useData'
import { computeCycleSummary, addDaysIso } from '../lib/cycle'
import { todayIso } from '../lib/supabase'
import { CalendarMonth } from '../components/CalendarMonth'

export function CalendarPage() {
  const { session } = useAuth()
  const userId = session?.user.id
  const navigate = useNavigate()
  const [month, setMonth] = useState(() => new Date())

  const trackers = useTrackers(userId)
  const allEntries = useAllEntries(userId)
  const flowTracker = trackers.data?.find((t) => t.system_key === 'period_flow')

  const { summary, loggedFlowDates } = useMemo(() => {
    const flowDates = (allEntries.data ?? [])
      .filter((e) => e.tracker_id === flowTracker?.id)
      .map((e) => e.date)
    return {
      summary: computeCycleSummary(flowDates, todayIso()),
      loggedFlowDates: new Set(flowDates),
    }
  }, [allEntries.data, flowTracker?.id])

  const predictionText = useMemo(() => {
    if (!summary.predictedNextStart) return 'Log a period to see predictions.'
    const from = addDaysIso(summary.predictedNextStart, -summary.predictionWindowDays)
    const to = addDaysIso(summary.predictedNextStart, summary.predictionWindowDays)
    const fmt = (iso: string) => format(parseISO(iso), 'd MMM')
    if (summary.daysLate > 0)
      return `Period is ${summary.daysLate} day${summary.daysLate === 1 ? '' : 's'} late — expected around ${fmt(summary.predictedNextStart)}.`
    if (summary.confidence === 'high') return `Next period expected around ${fmt(summary.predictedNextStart)}.`
    return `Next period expected ${fmt(from)} – ${fmt(to)}.`
  }, [summary])

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="mb-4 text-xl font-bold">Calendar</h1>
      <CalendarMonth
        month={month}
        onMonthChange={setMonth}
        summary={summary}
        loggedFlowDates={loggedFlowDates}
        onSelectDate={(iso) => {
          if (iso <= todayIso()) navigate(`/today?date=${iso}`)
        }}
      />
      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-medium">{predictionText}</p>
        {summary.confidence !== 'high' && summary.predictedNextStart && (
          <p className="mt-1 text-xs text-plum-soft">
            Confidence: {summary.confidence}
            {summary.confidence === 'low' && ' — predictions improve after a few logged cycles'}
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-plum-soft">
          Fertile window and ovulation are calendar estimates only — not suitable for contraception.
        </p>
      </div>
    </div>
  )
}
