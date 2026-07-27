// Pattern mining over completed cycles: "cramps usually start ~2 days before your period".
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { phaseForHistoricalDate, populationStddev, type Period } from './cycle'
import type { Phase } from './types'

export interface EntryLite {
  trackerId: string
  date: string
  value: unknown
}

export interface PatternInsight {
  trackerId: string
  medianOffsetDays: number // negative = before period start
  cyclesWithSignal: number
  totalCycles: number
  text: (trackerName: string) => string
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b))
}

/**
 * For each tracker, look at each completed cycle (period i start → period i+1 start)
 * and take the earliest logged date's offset relative to the NEXT period start.
 * Emit an insight when the tracker fires in ≥ 3 cycles, ≥ 60% of completed cycles,
 * and the offsets are consistent (population stddev ≤ 1.5).
 */
export function computePatternInsights(periods: Period[], entries: EntryLite[]): PatternInsight[] {
  if (periods.length < 2) return []
  const completedCycles: Array<[string, string]> = []
  for (let i = 1; i < periods.length; i++) {
    const len = diffDays(periods[i].start, periods[i - 1].start)
    if (len >= 15 && len <= 60) completedCycles.push([periods[i - 1].start, periods[i].start])
  }
  if (completedCycles.length === 0) return []

  const byTracker = new Map<string, EntryLite[]>()
  for (const e of entries) {
    const list = byTracker.get(e.trackerId) ?? []
    list.push(e)
    byTracker.set(e.trackerId, list)
  }

  const insights: PatternInsight[] = []
  for (const [trackerId, list] of byTracker) {
    const offsets: number[] = []
    for (const [start, nextStart] of completedCycles) {
      const inCycle = list
        .filter((e) => e.date >= start && e.date < nextStart)
        .sort((a, b) => a.date.localeCompare(b.date))
      if (inCycle.length > 0) offsets.push(diffDays(inCycle[0].date, nextStart))
    }
    if (offsets.length < 3) continue
    if (offsets.length / completedCycles.length < 0.6) continue
    if (populationStddev(offsets) > 1.5) continue

    const med = Math.round(median(offsets))
    insights.push({
      trackerId,
      medianOffsetDays: med,
      cyclesWithSignal: offsets.length,
      totalCycles: completedCycles.length,
      text: (name) =>
        med < 0
          ? `${name} tends to show up ~${Math.abs(med)} day${Math.abs(med) === 1 ? '' : 's'} before your period.`
          : `${name} tends to show up around day ${med + 1} of your cycle.`,
    })
  }
  return insights.sort((a, b) => a.medianOffsetDays - b.medianOffsetDays)
}

export interface PhaseAverage {
  phase: Phase
  average: number
  count: number
}

/** Average numeric value (scale/number trackers) per phase across completed cycles. */
export function computePhaseAverages(periods: Period[], entries: EntryLite[]): PhaseAverage[] {
  if (periods.length < 2) return []
  const sums = new Map<Phase, { sum: number; count: number }>()
  for (let i = 1; i < periods.length; i++) {
    const start = periods[i - 1].start
    const nextStart = periods[i].start
    const len = diffDays(nextStart, start)
    if (len < 15 || len > 60) continue
    for (const e of entries) {
      if (e.date < start || e.date >= nextStart) continue
      const v = typeof e.value === 'number' ? e.value : Number(e.value)
      if (!Number.isFinite(v)) continue
      const phase = phaseForHistoricalDate(e.date, start, nextStart, periods[i - 1].length)
      const agg = sums.get(phase) ?? { sum: 0, count: 0 }
      agg.sum += v
      agg.count += 1
      sums.set(phase, agg)
    }
  }
  const order: Phase[] = ['menstrual', 'follicular', 'ovulation', 'luteal']
  return order
    .filter((p) => sums.has(p))
    .map((p) => {
      const { sum, count } = sums.get(p)!
      return { phase: p, average: sum / count, count }
    })
}
