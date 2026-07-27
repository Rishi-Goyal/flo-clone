// Rule-based daily tips for the owner and their partner.
// Tips live in code (no DB table); selection is deterministic per (date, seed)
// so every device shows the same tip on the same day.
import type { Phase } from './types'

export type Audience = 'owner' | 'partner'

export interface TipRule {
  audience: Audience
  phase?: Phase
  /** matches when the period is overdue (past the prediction window). Wins over everything. */
  late?: boolean
  /** matches when daysUntilPeriod is within [min, max]. Wins over bare phase rules. */
  daysUntilPeriod?: [number, number]
  tips: string[]
}

export const TIP_RULES: TipRule[] = [
  // ---- partner: specific windows (checked before phase rules)
  {
    audience: 'partner',
    late: true,
    tips: [
      'Her period is running late — that can be stressful. Be gentle, and don\'t bring it up unless she does.',
      'Running later than predicted. Extra patience and zero pressure today.',
      'The prediction window has passed — keep things calm and comfortable, and follow her lead.',
    ],
  },
  {
    audience: 'partner',
    daysUntilPeriod: [0, 3],
    tips: [
      'Period likely starting in the next few days — stock up on her favourite snacks and have a heat pad ready.',
      'PMS peak days. If she seems off, it\'s not about you — lead with warmth, not solutions.',
      'Good day to quietly restock supplies: pads/tampons, chocolate, painkillers.',
      'Plan something low-effort and cozy for the next few evenings.',
    ],
  },
  {
    audience: 'partner',
    phase: 'menstrual',
    tips: [
      'Cramps and fatigue are common right now. Offer to handle dinner or chores tonight.',
      'A heat pad, warm drink, and a blanket go a long way today.',
      'Energy is at its lowest — suggest a quiet night in rather than plans.',
      'Small gestures count double this week: tea, snacks, zero judgment about the couch.',
    ],
  },
  {
    audience: 'partner',
    phase: 'follicular',
    tips: [
      'Energy is climbing — a great week to plan something active or new together.',
      'This is usually her most upbeat, social stretch. Book that thing you\'ve been putting off.',
      'Good week for adventures, workouts together, or tackling shared projects.',
    ],
  },
  {
    audience: 'partner',
    phase: 'ovulation',
    tips: [
      'Energy and mood usually peak around now — enjoy it together.',
      'She may feel her best right now; a compliment lands extra well today.',
      'Great time for a date night — energy and confidence tend to be high.',
    ],
  },
  {
    audience: 'partner',
    phase: 'luteal',
    tips: [
      'PMS window approaching — extra patience and reassurance go a long way.',
      'Comfort food and low-key plans beat big outings this week.',
      'Mood can dip in this phase. Listen more, fix less.',
      'If she\'s more tired or irritable than usual, it\'s the hormones talking — don\'t take it personally.',
    ],
  },
  // ---- owner
  {
    audience: 'owner',
    late: true,
    tips: [
      'Your period is later than predicted. Cycles vary — log it when it arrives and predictions will adjust.',
      'Running late vs. the prediction. Stress, travel, and sleep can all shift a cycle.',
    ],
  },
  {
    audience: 'owner',
    daysUntilPeriod: [0, 3],
    tips: [
      'Period expected soon — a good day to prep supplies and go easy on caffeine.',
      'PMS peak days. Gentle movement and extra sleep can take the edge off.',
      'Magnesium-rich snacks (dark chocolate counts) may help with cramps.',
    ],
  },
  {
    audience: 'owner',
    phase: 'menstrual',
    tips: [
      'Rest counts as productivity today. Hydrate and keep warm.',
      'Iron dips during your period — leafy greens, red meat, or lentils help.',
      'Light stretching or a short walk can ease cramps.',
    ],
  },
  {
    audience: 'owner',
    phase: 'follicular',
    tips: [
      'Rising oestrogen = rising energy. Great window for hard workouts and big tasks.',
      'This is typically your sharpest, most social phase — schedule accordingly.',
    ],
  },
  {
    audience: 'owner',
    phase: 'ovulation',
    tips: [
      'You\'re around ovulation — energy usually peaks now.',
      'Note: the fertile window shown is an estimate, not contraception-grade.',
    ],
  },
  {
    audience: 'owner',
    phase: 'luteal',
    tips: [
      'Progesterone rises now — it\'s normal to feel slower. Scale plans to your energy.',
      'Cravings and lower mood are common in this phase. Be kind to yourself.',
      'Prioritise sleep this week; it blunts PMS symptoms more than anything else.',
    ],
  },
]

function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h
}

export interface TipContext {
  currentPhase: Phase | null
  daysUntilPeriod: number | null
  daysLate: number
}

/**
 * Pick today's tip. Priority: late rules → daysUntilPeriod-range rules → phase rules.
 * Deterministic: hash(date + seed) chooses the variant, so the partner's phone
 * and laptop show the same tip with no server state.
 */
export function pickTip(audience: Audience, ctx: TipContext, isoDate: string, seed: string): string | null {
  const candidates = TIP_RULES.filter((r) => r.audience === audience)
  let rule: TipRule | undefined
  if (ctx.daysLate > 0) {
    rule = candidates.find((r) => r.late)
  }
  if (!rule && ctx.daysUntilPeriod !== null) {
    rule = candidates.find(
      (r) =>
        r.daysUntilPeriod &&
        ctx.daysUntilPeriod! >= r.daysUntilPeriod[0] &&
        ctx.daysUntilPeriod! <= r.daysUntilPeriod[1],
    )
  }
  if (!rule && ctx.currentPhase) {
    rule = candidates.find((r) => !r.daysUntilPeriod && !r.late && r.phase === ctx.currentPhase)
  }
  if (!rule) return null
  return rule.tips[hashString(isoDate + seed) % rule.tips.length]
}
