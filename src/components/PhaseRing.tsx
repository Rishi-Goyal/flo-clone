import type { Phase } from '../lib/types'
import { PHASE_UI } from './phaseUi'

/**
 * Cycle-progress ring: arc = cycleDay / avgCycleLength in the phase colour,
 * with "DAY / n / phase" centred. Track and label colours follow the phase.
 */
export function PhaseRing({
  cycleDay,
  avgCycleLength,
  phase,
  size = 196,
}: {
  cycleDay: number | null
  avgCycleLength: number | null
  phase: Phase | null
  size?: number
}) {
  const stroke = size >= 160 ? 14 : 10
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const progress =
    cycleDay && avgCycleLength ? Math.min(1, Math.max(0.02, cycleDay / avgCycleLength)) : 0
  const ui = phase ? PHASE_UI[phase] : PHASE_UI.menstrual

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ui.track} strokeWidth={stroke} />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ui.color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * progress} ${c}`}
            className="transition-all duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
        {cycleDay ? (
          <>
            <span className="text-xs font-medium uppercase tracking-[.08em]" style={{ color: ui.text }}>
              Day
            </span>
            <span className="font-display leading-none text-plum" style={{ fontSize: size * 0.33 }}>
              {cycleDay}
            </span>
            <span className="text-sm font-semibold" style={{ color: ui.text }}>
              {ui.label} phase
            </span>
          </>
        ) : (
          <span className="px-6 text-center text-xs text-plum-soft">Log your period to begin</span>
        )}
      </div>
    </div>
  )
}
