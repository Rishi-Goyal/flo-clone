import type { Phase } from '../lib/types'
import { PHASE_UI } from './phaseUi'

/**
 * Cycle-progress ring: arc = cycleDay / avgCycleLength, coloured by phase,
 * with the day + phase label in the centre.
 */
export function PhaseRing({
  cycleDay,
  avgCycleLength,
  phase,
  size = 148,
}: {
  cycleDay: number | null
  avgCycleLength: number | null
  phase: Phase | null
  size?: number
}) {
  const stroke = 12
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const progress =
    cycleDay && avgCycleLength ? Math.min(1, Math.max(0.02, cycleDay / avgCycleLength)) : 0
  const ui = phase ? PHASE_UI[phase] : null

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F6D3DD" strokeWidth={stroke} />
        {progress > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={ui?.color ?? '#E4557F'}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${c * progress} ${c}`}
            className="transition-all duration-500"
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {cycleDay ? (
          <>
            <span className="text-[11px] font-medium uppercase tracking-wide text-plum-soft">Day</span>
            <span className="text-4xl font-bold leading-none">{cycleDay}</span>
            {ui && (
              <span
                className="mt-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                style={{ background: ui.soft, color: ui.text }}
              >
                {ui.label}
              </span>
            )}
          </>
        ) : (
          <span className="px-4 text-center text-xs text-plum-soft">Log your period to begin</span>
        )}
      </div>
    </div>
  )
}
