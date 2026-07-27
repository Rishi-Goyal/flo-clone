import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllEntries, useTrackers } from '../hooks/useData'
import { computeCycleSummary } from '../lib/cycle'
import { computePatternInsights, computePhaseAverages } from '../lib/insights'
import { todayIso } from '../lib/supabase'
import { StatCard } from '../components/StatCard'
import { TrackerIcon } from '../components/TrackerIcon'
import { PHASE_UI } from '../components/phaseUi'
import { Sparkles } from 'lucide-react'

export function Insights() {
  const { session } = useAuth()
  const userId = session?.user.id
  const trackers = useTrackers(userId)
  const allEntries = useAllEntries(userId)

  const flowTracker = trackers.data?.find((t) => t.system_key === 'period_flow')

  const data = useMemo(() => {
    const entries = allEntries.data ?? []
    const flowDates = entries.filter((e) => e.tracker_id === flowTracker?.id).map((e) => e.date)
    const summary = computeCycleSummary(flowDates, todayIso())
    const nonFlow = entries
      .filter((e) => e.tracker_id !== flowTracker?.id)
      .map((e) => ({ trackerId: e.tracker_id, date: e.date, value: e.value }))
    const patterns = computePatternInsights(summary.periods, nonFlow)
    // per-phase averages for numeric trackers
    const numericTrackers = (trackers.data ?? []).filter(
      (t) => (t.input_type === 'scale' || t.input_type === 'number') && t.is_active,
    )
    const phaseAverages = numericTrackers
      .map((t) => ({
        tracker: t,
        averages: computePhaseAverages(
          summary.periods,
          nonFlow.filter((e) => e.trackerId === t.id),
        ),
      }))
      .filter((x) => x.averages.length >= 2)
    return { summary, patterns, phaseAverages }
  }, [allEntries.data, flowTracker?.id, trackers.data])

  const { summary, patterns, phaseAverages } = data
  const trackerById = new Map((trackers.data ?? []).map((t) => [t.id, t]))

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="mb-4 text-xl font-bold">Insights</h1>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Avg cycle"
          value={summary.validCycleLengths.length ? `${Math.round(summary.avgCycleLength)} days` : '—'}
          sub={summary.validCycleLengths.length ? `from ${summary.validCycleLengths.length} cycles` : 'need 2+ periods'}
        />
        <StatCard
          label="Avg period"
          value={summary.periods.length ? `${Math.round(summary.avgPeriodLength)} days` : '—'}
        />
        <StatCard
          label="Variability"
          value={summary.cycleStddev !== null ? `±${summary.cycleStddev.toFixed(1)} days` : '—'}
          sub={summary.cycleStddev === null ? 'need 3+ cycles' : undefined}
        />
        <StatCard
          label="Confidence"
          value={summary.confidence[0].toUpperCase() + summary.confidence.slice(1)}
          sub="prediction quality"
        />
      </div>

      {/* cycle length history */}
      {summary.validCycleLengths.length > 0 && (
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-plum-soft">
            Recent cycle lengths
          </p>
          <div className="mt-3 flex h-28 items-end gap-2">
            {summary.validCycleLengths.map((len, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] font-semibold text-plum-soft">{len}</span>
                <div
                  className="w-full rounded-t-lg bg-rose/80"
                  style={{ height: `${(len / 45) * 100}%` }}
                />
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-[10px] text-plum-soft">oldest → newest (days)</p>
        </div>
      )}

      {/* pattern insights */}
      {patterns.length > 0 && (
        <div className="mt-4 space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-plum-soft">Patterns</h2>
          {patterns.map((p) => {
            const t = trackerById.get(p.trackerId)
            if (!t) return null
            return (
              <div key={p.trackerId} className="flex items-start gap-3 rounded-2xl bg-white p-4 shadow-sm">
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `${t.color}22` }}
                >
                  <TrackerIcon name={t.icon} size={16} color={t.color} />
                </span>
                <div>
                  <p className="text-sm font-medium leading-relaxed">{p.text(t.name)}</p>
                  <p className="mt-0.5 text-[11px] text-plum-soft">
                    seen in {p.cyclesWithSignal} of {p.totalCycles} cycles
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* phase averages */}
      {phaseAverages.length > 0 && (
        <div className="mt-4 space-y-2">
          <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-plum-soft">By phase</h2>
          {phaseAverages.map(({ tracker, averages }) => (
            <div key={tracker.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <TrackerIcon name={tracker.icon} size={15} color={tracker.color} />
                <span className="text-sm font-semibold">{tracker.name}</span>
                {tracker.config.unit && <span className="text-xs text-plum-soft">({tracker.config.unit})</span>}
              </div>
              <div className="flex gap-2">
                {averages.map((a) => (
                  <div
                    key={a.phase}
                    className="flex-1 rounded-xl p-2 text-center"
                    style={{ background: PHASE_UI[a.phase].soft }}
                  >
                    <p className="text-base font-bold" style={{ color: PHASE_UI[a.phase].text }}>
                      {a.average.toFixed(1)}
                    </p>
                    <p className="text-[10px] font-medium text-plum-soft">{PHASE_UI[a.phase].label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {patterns.length === 0 && summary.periods.length < 4 && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl bg-blush p-4">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-rose" />
          <p className="text-xs leading-relaxed text-plum-soft">
            Pattern insights appear after 3–4 logged cycles — keep logging symptoms and they'll show up
            here automatically.
          </p>
        </div>
      )}
    </div>
  )
}
