import { describe, expect, it } from 'vitest'
import { addDaysIso, derivePeriods } from './cycle'
import { computePatternInsights, computePhaseAverages, type EntryLite } from './insights'

function makeFlow(firstStart: string, cycleLen: number, count: number, periodLen = 5): string[] {
  const dates: string[] = []
  let start = firstStart
  for (let i = 0; i < count; i++) {
    for (let d = 0; d < periodLen; d++) dates.push(addDaysIso(start, d))
    start = addDaysIso(start, cycleLen)
  }
  return dates
}

describe('computePatternInsights', () => {
  const periods = derivePeriods(makeFlow('2026-01-01', 28, 5)) // 4 completed cycles

  it('detects a consistent pre-period symptom', () => {
    // cramps 2 days before each of the 4 next-period starts
    const cramps: EntryLite[] = periods.slice(1).map((p) => ({
      trackerId: 'cramps',
      date: addDaysIso(p.start, -2),
      value: true,
    }))
    const insights = computePatternInsights(periods, cramps)
    expect(insights).toHaveLength(1)
    expect(insights[0].medianOffsetDays).toBe(-2)
    expect(insights[0].text('Cramps')).toBe('Cramps tends to show up ~2 days before your period.')
  })

  it('ignores trackers logged in fewer than 3 cycles', () => {
    const sparse: EntryLite[] = [
      { trackerId: 'headache', date: addDaysIso(periods[1].start, -1), value: true },
      { trackerId: 'headache', date: addDaysIso(periods[2].start, -1), value: true },
    ]
    expect(computePatternInsights(periods, sparse)).toHaveLength(0)
  })

  it('ignores inconsistent offsets (stddev > 1.5)', () => {
    const noisy: EntryLite[] = [
      { trackerId: 'headache', date: addDaysIso(periods[1].start, -12), value: true },
      { trackerId: 'headache', date: addDaysIso(periods[2].start, -1), value: true },
      { trackerId: 'headache', date: addDaysIso(periods[3].start, -6), value: true },
      { trackerId: 'headache', date: addDaysIso(periods[4].start, -2), value: true },
    ]
    expect(computePatternInsights(periods, noisy)).toHaveLength(0)
  })

  it('returns nothing with fewer than 2 periods', () => {
    const single = derivePeriods(['2026-01-01', '2026-01-02'])
    expect(computePatternInsights(single, [])).toHaveLength(0)
  })
})

describe('computePhaseAverages', () => {
  const periods = derivePeriods(makeFlow('2026-01-01', 28, 3))

  it('averages numeric values per phase', () => {
    const entries: EntryLite[] = [
      // menstrual days (day 1-2 of first two cycles): energy 2
      { trackerId: 'energy', date: '2026-01-01', value: 2 },
      { trackerId: 'energy', date: '2026-01-30', value: 2 },
      // follicular (day 10): energy 4
      { trackerId: 'energy', date: '2026-01-10', value: 4 },
      { trackerId: 'energy', date: '2026-02-07', value: 4 },
    ]
    const averages = computePhaseAverages(periods, entries)
    const menstrual = averages.find((a) => a.phase === 'menstrual')
    const follicular = averages.find((a) => a.phase === 'follicular')
    expect(menstrual?.average).toBe(2)
    expect(menstrual?.count).toBe(2)
    expect(follicular?.average).toBe(4)
  })

  it('skips non-numeric values', () => {
    const entries: EntryLite[] = [{ trackerId: 'mood', date: '2026-01-10', value: ['happy'] }]
    expect(computePhaseAverages(periods, entries)).toHaveLength(0)
  })
})
