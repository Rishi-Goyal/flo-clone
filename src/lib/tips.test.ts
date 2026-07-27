import { describe, expect, it } from 'vitest'
import { pickTip, TIP_RULES } from './tips'

describe('pickTip', () => {
  const base = { currentPhase: 'luteal' as const, daysUntilPeriod: 10, daysLate: 0 }

  it('is deterministic for the same date and seed', () => {
    const a = pickTip('partner', base, '2026-07-27', 'user-1')
    const b = pickTip('partner', base, '2026-07-27', 'user-1')
    expect(a).toBe(b)
    expect(a).toBeTruthy()
  })

  it('rotates across days', () => {
    const tips = new Set(
      ['2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25'].map((d) =>
        pickTip('partner', base, d, 'user-1'),
      ),
    )
    expect(tips.size).toBeGreaterThan(1)
  })

  it('prefers the imminent window rule over the phase rule', () => {
    const tip = pickTip('partner', { currentPhase: 'luteal', daysUntilPeriod: 2, daysLate: 0 }, '2026-07-27', 'u')
    const imminentRule = TIP_RULES.find((r) => r.audience === 'partner' && r.daysUntilPeriod?.[0] === 0)!
    expect(imminentRule.tips).toContain(tip)
  })

  it('prefers the late rule over everything when overdue', () => {
    const tip = pickTip('partner', { currentPhase: 'luteal', daysUntilPeriod: -6, daysLate: 3 }, '2026-07-27', 'u')
    const lateRule = TIP_RULES.find((r) => r.audience === 'partner' && r.late)!
    expect(lateRule.tips).toContain(tip)
  })

  it('falls back to phase rules', () => {
    const tip = pickTip('owner', { currentPhase: 'follicular', daysUntilPeriod: 18, daysLate: 0 }, '2026-07-27', 'u')
    const phaseRule = TIP_RULES.find((r) => r.audience === 'owner' && r.phase === 'follicular')!
    expect(phaseRule.tips).toContain(tip)
  })

  it('returns null with no cycle data', () => {
    expect(pickTip('partner', { currentPhase: null, daysUntilPeriod: null, daysLate: 0 }, '2026-07-27', 'u')).toBeNull()
  })

  it('every audience/phase combination has coverage', () => {
    for (const audience of ['owner', 'partner'] as const) {
      for (const phase of ['menstrual', 'follicular', 'ovulation', 'luteal'] as const) {
        expect(pickTip(audience, { currentPhase: phase, daysUntilPeriod: 10, daysLate: 0 }, '2026-07-27', 'u')).toBeTruthy()
      }
    }
  })
})
