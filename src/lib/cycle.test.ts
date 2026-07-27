import { describe, expect, it } from 'vitest'
import { addDaysIso, computeCycleSummary, dayFlags, derivePeriods, deriveValidCycleLengths } from './cycle'

/** Generate flow dates: `count` periods of `periodLen` days, starting `firstStart`, every `cycleLen` days. */
function makeFlowDates(firstStart: string, cycleLen: number | number[], count: number, periodLen = 5): string[] {
  const dates: string[] = []
  let start = firstStart
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < periodLen; d++) dates.push(addDaysIso(start, d))
    const len = Array.isArray(cycleLen) ? cycleLen[i % cycleLen.length] : cycleLen
    start = addDaysIso(start, len)
  }
  return dates
}

describe('derivePeriods', () => {
  it('groups consecutive flow days into one period', () => {
    const periods = derivePeriods(['2026-01-01', '2026-01-02', '2026-01-03'])
    expect(periods).toEqual([{ start: '2026-01-01', end: '2026-01-03', length: 3 }])
  })

  it('merges a single missed logging day (gap of 2)', () => {
    const periods = derivePeriods(['2026-01-01', '2026-01-02', '2026-01-04'])
    expect(periods).toHaveLength(1)
    expect(periods[0].length).toBe(4)
  })

  it('splits on gaps larger than 2 days', () => {
    const periods = derivePeriods(['2026-01-01', '2026-01-02', '2026-01-29', '2026-01-30'])
    expect(periods).toHaveLength(2)
  })

  it('handles duplicates and unsorted input', () => {
    const periods = derivePeriods(['2026-01-02', '2026-01-01', '2026-01-02'])
    expect(periods).toEqual([{ start: '2026-01-01', end: '2026-01-02', length: 2 }])
  })
})

describe('deriveValidCycleLengths', () => {
  it('filters out gaps from unlogged months', () => {
    // second cycle is 90 days (invalid), third is 28
    const periods = derivePeriods([
      ...makeFlowDates('2026-01-01', 28, 2, 3),
      ...makeFlowDates('2026-04-29', 28, 2, 3), // 90 days after 2026-01-29
    ])
    expect(periods).toHaveLength(4)
    const lengths = deriveValidCycleLengths(periods)
    expect(lengths).toEqual([28, 28])
  })
})

describe('computeCycleSummary — regular 28-day history', () => {
  // 5 periods → 4 valid cycles of exactly 28 days; last starts 2026-04-23
  const flow = makeFlowDates('2026-01-01', 28, 5)
  const today = '2026-05-01' // cycle day 9
  const s = computeCycleSummary(flow, today)

  it('computes averages and confidence', () => {
    expect(s.avgCycleLength).toBe(28)
    expect(s.cycleStddev).toBe(0)
    expect(s.avgPeriodLength).toBe(5)
    expect(s.confidence).toBe('high')
  })

  it('predicts next period with tight window', () => {
    expect(s.lastPeriodStart).toBe('2026-04-23')
    expect(s.predictedNextStart).toBe('2026-05-21')
    expect(s.predictionWindowDays).toBe(1) // clamp(round(0), 1, 5)
  })

  it('places ovulation and fertile window', () => {
    expect(s.ovulationDate).toBe('2026-05-07') // next − 14
    expect(s.fertileWindowStart).toBe('2026-05-02')
    expect(s.fertileWindowEnd).toBe('2026-05-08')
  })

  it('reports phase and countdown', () => {
    expect(s.cycleDay).toBe(9)
    expect(s.currentPhase).toBe('follicular')
    expect(s.daysUntilPeriod).toBe(20)
    expect(s.daysLate).toBe(0)
  })

  it('identifies each phase across the cycle', () => {
    expect(computeCycleSummary(flow, '2026-04-25').currentPhase).toBe('menstrual')
    expect(computeCycleSummary(flow, '2026-05-07').currentPhase).toBe('ovulation')
    expect(computeCycleSummary(flow, '2026-05-15').currentPhase).toBe('luteal')
  })
})

describe('computeCycleSummary — irregular cycles', () => {
  // cycle lengths 22, 38, 25, 40 → stddev > 5 → low confidence
  const flow = makeFlowDates('2026-01-01', [22, 38, 25, 40], 5)
  const s = computeCycleSummary(flow, '2026-05-10')

  it('reports low confidence and wide window', () => {
    expect(s.confidence).toBe('low')
    expect(s.predictionWindowDays).toBe(4)
  })

  it('widens the fertile window by 2 days each side', () => {
    const ovulation = s.ovulationDate!
    expect(s.fertileWindowStart).toBe(addDaysIso(ovulation, -7))
    expect(s.fertileWindowEnd).toBe(addDaysIso(ovulation, 3))
  })
})

describe('computeCycleSummary — sparse data', () => {
  it('single period → defaults with low confidence, still predicts', () => {
    const s = computeCycleSummary(['2026-06-01', '2026-06-02', '2026-06-03'], '2026-06-10')
    expect(s.avgCycleLength).toBe(28)
    expect(s.confidence).toBe('low')
    expect(s.predictedNextStart).toBe('2026-06-29')
    expect(s.predictionWindowDays).toBe(4)
  })

  it('no data → nulls', () => {
    const s = computeCycleSummary([], '2026-06-10')
    expect(s.lastPeriodStart).toBeNull()
    expect(s.predictedNextStart).toBeNull()
    expect(s.currentPhase).toBeNull()
  })

  it('two cycles without stddev → medium confidence', () => {
    const s = computeCycleSummary(makeFlowDates('2026-01-01', 28, 3), '2026-03-01')
    expect(s.validCycleLengths).toHaveLength(2)
    expect(s.confidence).toBe('medium')
  })
})

describe('computeCycleSummary — late period', () => {
  const flow = makeFlowDates('2026-01-01', 28, 5) // predicted 2026-05-21, window 1
  const s = computeCycleSummary(flow, '2026-05-25')

  it('reports days late past the window', () => {
    expect(s.daysUntilPeriod).toBe(-4)
    expect(s.daysLate).toBe(3) // 4 days overdue − 1 window day
    expect(s.currentPhase).toBe('luteal')
  })

  it('extends the predicted start window up to today in day flags', () => {
    const flags = dayFlags(s, '2026-05-24', '2026-05-25', new Set(flow))
    expect(flags.isStartWindow).toBe(true)
  })
})

describe('dayFlags', () => {
  const flow = makeFlowDates('2026-01-01', 28, 5)
  const s = computeCycleSummary(flow, '2026-05-01')
  const logged = new Set(flow)

  it('marks logged period days', () => {
    expect(dayFlags(s, '2026-04-24', '2026-05-01', logged).isPeriod).toBe(true)
  })

  it('marks predicted period days', () => {
    expect(dayFlags(s, '2026-05-21', '2026-05-01', logged).isPredictedPeriod).toBe(true)
    expect(dayFlags(s, '2026-05-25', '2026-05-01', logged).isPredictedPeriod).toBe(true)
    expect(dayFlags(s, '2026-05-26', '2026-05-01', logged).isPredictedPeriod).toBe(false)
  })

  it('marks fertile window and ovulation', () => {
    expect(dayFlags(s, '2026-05-05', '2026-05-01', logged).isFertile).toBe(true)
    expect(dayFlags(s, '2026-05-07', '2026-05-01', logged).isOvulation).toBe(true)
  })
})
