// Mapping between the pure CycleSummary and the cycle_stats DB row.
// The row snapshots phase/cycle_day at write time; readers re-derive the
// day-dependent fields from the stable ones so a stale row stays correct.
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { CycleSummary } from './cycle'
import type { Confidence, CycleStatsRow, Phase } from './types'

export function rowFromSummary(userId: string, s: CycleSummary): Omit<CycleStatsRow, 'updated_at'> {
  return {
    user_id: userId,
    last_period_start: s.lastPeriodStart,
    avg_cycle_length: s.avgCycleLength,
    cycle_length_stddev: s.cycleStddev,
    avg_period_length: s.avgPeriodLength,
    predicted_next_start: s.predictedNextStart,
    prediction_window_days: s.predictionWindowDays,
    fertile_window_start: s.fertileWindowStart,
    fertile_window_end: s.fertileWindowEnd,
    ovulation_date: s.ovulationDate,
    current_phase: s.currentPhase,
    cycle_day: s.cycleDay,
    confidence: s.confidence,
  }
}

export interface LiveStats {
  currentPhase: Phase | null
  cycleDay: number | null
  daysUntilPeriod: number | null
  daysLate: number
  predictedNextStart: string | null
  predictionWindowDays: number
  avgCycleLength: number | null
  avgPeriodLength: number | null
  confidence: Confidence | null
  lastPeriodStart: string | null
}

function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b))
}

/** Re-derive today-dependent fields from a (possibly days-old) cycle_stats row. */
export function liveFromRow(row: CycleStatsRow, today: string): LiveStats {
  const base: LiveStats = {
    currentPhase: null,
    cycleDay: null,
    daysUntilPeriod: null,
    daysLate: 0,
    predictedNextStart: row.predicted_next_start,
    predictionWindowDays: row.prediction_window_days ?? 4,
    avgCycleLength: row.avg_cycle_length,
    avgPeriodLength: row.avg_period_length,
    confidence: row.confidence,
    lastPeriodStart: row.last_period_start,
  }
  if (!row.last_period_start || !row.predicted_next_start) return base

  const cycleDay = diffDays(today, row.last_period_start) + 1
  const daysUntilPeriod = diffDays(row.predicted_next_start, today)
  const daysLate = Math.max(0, -daysUntilPeriod - (row.prediction_window_days ?? 4))

  let currentPhase: Phase
  if (cycleDay <= Math.round(row.avg_period_length ?? 5)) {
    currentPhase = 'menstrual'
  } else if (row.ovulation_date) {
    const dist = diffDays(today, row.ovulation_date)
    currentPhase = dist >= -1 && dist <= 1 ? 'ovulation' : dist < -1 ? 'follicular' : 'luteal'
  } else {
    currentPhase = 'follicular'
  }

  return { ...base, currentPhase, cycleDay, daysUntilPeriod, daysLate }
}

export const PHASE_LABELS: Record<Phase, string> = {
  menstrual: 'Period',
  follicular: 'Follicular',
  ovulation: 'Ovulation',
  luteal: 'Luteal',
}

export const PHASE_EXPLAIN: Record<Phase, string> = {
  menstrual: 'The period itself. Energy and iron are at their lowest — rest and warmth help most.',
  follicular: 'Oestrogen is rising. Typically the most energetic, upbeat stretch of the cycle.',
  ovulation: 'The egg is released around now. Energy and mood usually peak.',
  luteal: 'Progesterone rises after ovulation. Energy dips and PMS symptoms can appear toward the end.',
}
