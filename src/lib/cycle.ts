// Pure cycle-prediction functions. All dates are ISO strings (yyyy-MM-dd).
import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns'
import type { Confidence, Phase } from './types'

export interface Period {
  start: string
  end: string
  length: number
}

export interface CycleSummary {
  periods: Period[]
  validCycleLengths: number[]
  lastPeriodStart: string | null
  avgCycleLength: number
  cycleStddev: number | null
  avgPeriodLength: number
  confidence: Confidence
  predictedNextStart: string | null
  predictionWindowDays: number
  ovulationDate: string | null
  fertileWindowStart: string | null
  fertileWindowEnd: string | null
  currentPhase: Phase | null
  cycleDay: number | null
  /** predicted_next_start − today; negative when the period is late */
  daysUntilPeriod: number | null
  /** days past the end of the uncertainty window; 0 when not late */
  daysLate: number
}

const DEFAULT_CYCLE = 28
const DEFAULT_PERIOD = 5
const LUTEAL_DAYS = 14
const MAX_RECENT_CYCLES = 6

function iso(d: Date): string {
  return format(d, 'yyyy-MM-dd')
}

function diffDays(a: string, b: string): number {
  return differenceInCalendarDays(parseISO(a), parseISO(b))
}

export function addDaysIso(date: string, days: number): string {
  return iso(addDays(parseISO(date), days))
}

/** Group logged flow dates into periods, merging runs with a single missed day (gap ≤ 2). */
export function derivePeriods(flowDates: string[]): Period[] {
  const dates = [...new Set(flowDates)].sort()
  const periods: Period[] = []
  for (const date of dates) {
    const current = periods[periods.length - 1]
    if (current && diffDays(date, current.end) <= 2) {
      current.end = date
      current.length = diffDays(current.end, current.start) + 1
    } else {
      periods.push({ start: date, end: date, length: 1 })
    }
  }
  return periods
}

/** Cycle lengths between consecutive period starts; 15–60 days considered valid; most recent kept. */
export function deriveValidCycleLengths(periods: Period[]): number[] {
  const lengths: number[] = []
  for (let i = 1; i < periods.length; i++) {
    const len = diffDays(periods[i].start, periods[i - 1].start)
    if (len >= 15 && len <= 60) lengths.push(len)
  }
  return lengths.slice(-MAX_RECENT_CYCLES)
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

export function populationStddev(xs: number[]): number {
  const m = mean(xs)
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)))
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x))
}

export function computeCycleSummary(flowDates: string[], today: string): CycleSummary {
  const periods = derivePeriods(flowDates)
  const validCycleLengths = deriveValidCycleLengths(periods)

  const avgCycleLength = validCycleLengths.length > 0 ? mean(validCycleLengths) : DEFAULT_CYCLE
  const cycleStddev = validCycleLengths.length >= 3 ? populationStddev(validCycleLengths) : null

  const recentPeriods = periods.slice(-MAX_RECENT_CYCLES)
  const avgPeriodLength = recentPeriods.length > 0 ? mean(recentPeriods.map((p) => p.length)) : DEFAULT_PERIOD

  let confidence: Confidence = 'low'
  if (validCycleLengths.length >= 4 && cycleStddev !== null && cycleStddev <= 2) confidence = 'high'
  else if (validCycleLengths.length >= 2 && cycleStddev !== null && cycleStddev <= 5) confidence = 'medium'
  else if (validCycleLengths.length >= 2 && cycleStddev === null) confidence = 'medium'

  const lastPeriodStart = periods.length > 0 ? periods[periods.length - 1].start : null

  const empty: CycleSummary = {
    periods,
    validCycleLengths,
    lastPeriodStart,
    avgCycleLength,
    cycleStddev,
    avgPeriodLength,
    confidence,
    predictedNextStart: null,
    predictionWindowDays: 4,
    ovulationDate: null,
    fertileWindowStart: null,
    fertileWindowEnd: null,
    currentPhase: null,
    cycleDay: null,
    daysUntilPeriod: null,
    daysLate: 0,
  }
  if (!lastPeriodStart) return empty

  const predictedNextStart = addDaysIso(lastPeriodStart, Math.round(avgCycleLength))
  const predictionWindowDays =
    confidence === 'low' || cycleStddev === null ? 4 : clamp(Math.round(cycleStddev), 1, 5)

  let ovulationDate = addDaysIso(predictedNextStart, -LUTEAL_DAYS)
  let fertileStartOffset = -5
  let fertileEndOffset = 1
  if (confidence === 'low') {
    fertileStartOffset -= 2
    fertileEndOffset += 2
  }
  const fertileWindowStart = addDaysIso(ovulationDate, fertileStartOffset)
  const fertileWindowEnd = addDaysIso(ovulationDate, fertileEndOffset)

  const cycleDay = diffDays(today, lastPeriodStart) + 1
  const daysUntilPeriod = diffDays(predictedNextStart, today)
  const daysLate = Math.max(0, -daysUntilPeriod - predictionWindowDays)

  let currentPhase: Phase
  if (cycleDay <= Math.round(avgPeriodLength)) {
    currentPhase = 'menstrual'
  } else {
    const distToOvulation = diffDays(today, ovulationDate)
    if (distToOvulation >= -1 && distToOvulation <= 1) currentPhase = 'ovulation'
    else if (distToOvulation < -1) currentPhase = 'follicular'
    else currentPhase = 'luteal'
  }

  return {
    ...empty,
    predictedNextStart,
    predictionWindowDays,
    ovulationDate,
    fertileWindowStart,
    fertileWindowEnd,
    currentPhase,
    cycleDay,
    daysUntilPeriod,
    daysLate,
  }
}

/** Calendar overlay info for one date. `loggedFlowDates` should be a Set for speed. */
export interface DayFlags {
  isPeriod: boolean
  isPredictedPeriod: boolean
  isStartWindow: boolean
  isFertile: boolean
  isOvulation: boolean
}

export function dayFlags(
  summary: CycleSummary,
  date: string,
  today: string,
  loggedFlowDates: Set<string>,
): DayFlags {
  const flags: DayFlags = {
    isPeriod: loggedFlowDates.has(date),
    isPredictedPeriod: false,
    isStartWindow: false,
    isFertile: false,
    isOvulation: false,
  }
  const { predictedNextStart, predictionWindowDays, ovulationDate, fertileWindowStart, fertileWindowEnd } = summary
  if (predictedNextStart) {
    const fromStart = diffDays(date, predictedNextStart)
    if (fromStart >= 0 && fromStart < Math.round(summary.avgPeriodLength)) flags.isPredictedPeriod = true
    // uncertainty window around the predicted start; extends to today when late
    const windowEnd = summary.daysLate > 0 ? diffDays(today, predictedNextStart) : predictionWindowDays
    if (fromStart >= -predictionWindowDays && fromStart <= windowEnd) flags.isStartWindow = true
  }
  if (fertileWindowStart && fertileWindowEnd && date >= fertileWindowStart && date <= fertileWindowEnd) {
    flags.isFertile = true
  }
  if (ovulationDate === date) flags.isOvulation = true
  return flags
}

/** Assign a phase to a historical date inside a completed cycle. */
export function phaseForHistoricalDate(
  date: string,
  cycleStart: string,
  nextCycleStart: string,
  periodLength: number,
): Phase {
  const day = diffDays(date, cycleStart) + 1
  if (day <= Math.round(periodLength)) return 'menstrual'
  const ovulation = addDaysIso(nextCycleStart, -LUTEAL_DAYS)
  const dist = diffDays(date, ovulation)
  if (dist >= -1 && dist <= 1) return 'ovulation'
  return dist < -1 ? 'follicular' : 'luteal'
}
