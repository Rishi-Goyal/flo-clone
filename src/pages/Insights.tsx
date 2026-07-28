import { useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAllEntries, useTrackers } from '../hooks/useData'
import { computeCycleSummary } from '../lib/cycle'
import { computePatternInsights, computePhaseAverages } from '../lib/insights'
import { todayIso } from '../lib/supabase'
import { TrackerIcon, MSymbol } from '../components/TrackerIcon'
import { PHASE_UI } from '../components/phaseUi'

const PATTERN_TINTS = [
  { bg: '#FBE9EE', meta: '#8F2B4C' },
  { bg: '#FBEED8', meta: '#8A5C12' },
  { bg: '#EFE8F8', meta: '#6E51A0' },
  { bg: '#DDF0EA', meta: '#2F6D59' },
]

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
  const cycleCount = summary.validCycleLengths.length

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      <h1 className="font-display text-[28px] font-medium tracking-[-.01em]">Your patterns</h1>
      <p className="mb-5 mt-1.5 text-[15px] text-ink-mute">
        {cycleCount >= 2
          ? `${cycleCount} cycles in — here's what keeps showing up.`
          : 'Patterns appear after a few logged cycles.'}
      </p>

      {/* pattern cards */}
      {patterns.length > 0 && (
        <div className="space-y-3">
          {patterns.map((p, i) => {
            const t = trackerById.get(p.trackerId)
            if (!t) return null
            const tint = PATTERN_TINTS[i % PATTERN_TINTS.length]
            return (
              <div key={p.trackerId} className="rounded-[28px] p-6" style={{ background: tint.bg }}>
                <p className="font-display text-[22px] leading-normal text-plum">{p.text(t.name)}</p>
                <p className="mt-3 flex items-center gap-2 text-sm font-medium" style={{ color: tint.meta }}>
                  <TrackerIcon name={t.icon} size={16} color={tint.meta} />
                  Seen in {p.cyclesWithSignal} of your last {p.totalCycles} cycles
                </p>
              </div>
            )
          })}
        </div>
      )}

      {/* cycle length */}
      {cycleCount > 0 && (
        <div className="mt-5 rounded-[28px] border border-line bg-white p-6">
          <p className="text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">Cycle length</p>
          <div className="mt-1.5 flex items-baseline gap-2.5">
            <span className="font-display text-[44px] leading-none">{Math.round(summary.avgCycleLength)}</span>
            <span className="text-base text-ink-mute">
              days on average
              {summary.cycleStddev !== null && summary.cycleStddev >= 0.5
                ? `, give or take ${Math.round(summary.cycleStddev)}`
                : ''}
            </span>
          </div>
          <div className="mt-5 flex h-24 items-end gap-2.5">
            {summary.validCycleLengths.map((len, i) => {
              const last = i === summary.validCycleLengths.length - 1
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-lg"
                    style={{ height: `${(len / 45) * 100}%`, background: last ? '#E4557F' : '#F6D3DD' }}
                  />
                  <span className={`text-xs ${last ? 'font-semibold text-rose-deep' : 'text-plum-soft'}`}>{len}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* per-phase averages */}
      {phaseAverages.map(({ tracker, averages }) => {
        const max = Math.max(tracker.config.max ?? 5, ...averages.map((a) => a.average))
        return (
          <div key={tracker.id} className="mt-5 rounded-[28px] border border-line bg-white p-6">
            <p className="mb-4 text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">
              {tracker.name} by phase{tracker.config.unit ? ` (${tracker.config.unit})` : ''}
            </p>
            <div className="flex flex-col gap-3.5">
              {averages.map((a) => (
                <div key={a.phase} className="flex items-center gap-3.5">
                  <span className="w-[76px] text-sm text-ink-mute">{PHASE_UI[a.phase].label}</span>
                  <div className="h-3 flex-1 rounded-full bg-line-soft">
                    <div
                      className="h-3 rounded-full"
                      style={{
                        width: `${Math.min(100, (a.average / max) * 100)}%`,
                        background: PHASE_UI[a.phase].color,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold">{a.average.toFixed(1)}</span>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {patterns.length === 0 && summary.periods.length < 4 && (
        <div className="mt-4 flex items-start gap-3.5 rounded-[28px] bg-blush p-5">
          <MSymbol name="auto_awesome" size={20} color="#C43D68" className="mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed text-ink-mute">
            Pattern insights appear after 3–4 logged cycles — keep logging symptoms and they'll show up
            here automatically.
          </p>
        </div>
      )}
    </div>
  )
}
