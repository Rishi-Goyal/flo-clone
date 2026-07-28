import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { dayFlags, type CycleSummary } from '../lib/cycle'
import { todayIso } from '../lib/supabase'
import { MSymbol } from './TrackerIcon'

/**
 * Month grid, redesign style: round pill days — solid rose for logged period,
 * dashed rose ring for the expected window, teal tint for the fertile
 * estimate, plum inset ring for today. Out-of-month days fade to 32%.
 */
export function CalendarMonth({
  month,
  onMonthChange,
  summary,
  loggedFlowDates,
  onSelectDate,
  cellSize = 40,
}: {
  month: Date
  onMonthChange: (m: Date) => void
  summary: CycleSummary
  loggedFlowDates: Set<string>
  onSelectDate?: (iso: string) => void
  cellSize?: number
}) {
  const today = todayIso()
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="Previous month"
        >
          <MSymbol name="chevron_left" size={24} />
        </button>
        <span className="font-display text-lg font-medium">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Next month"
        >
          <MSymbol name="chevron_right" size={24} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-2 text-[13px] font-medium text-plum-soft">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const iso = format(d, 'yyyy-MM-dd')
          const inMonth = isSameMonth(d, month)
          const flags = dayFlags(summary, iso, today, loggedFlowDates)
          const isToday = iso === today

          const style: React.CSSProperties = { width: cellSize, height: cellSize }
          let cls = 'text-plum font-normal'
          if (flags.isPeriod) {
            style.background = '#E4557F'
            cls = 'text-white font-semibold'
          } else if (flags.isPredictedPeriod || (flags.isStartWindow && !flags.isFertile)) {
            style.border = '2px dashed #E4557F'
            cls = 'text-rose-deep font-medium'
          } else if (flags.isFertile) {
            style.background = '#DDF0EA'
            cls = 'text-fertile-deep font-medium'
          }
          if (isToday) {
            style.boxShadow = 'inset 0 0 0 2px #47243A'
            cls += ' font-bold'
          }
          if (!inMonth) cls += ' opacity-30'

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              className={`relative mx-auto flex items-center justify-center rounded-full text-[15px] transition-transform active:scale-90 ${cls}`}
              style={style}
            >
              {format(d, 'd')}
              {flags.isOvulation && (
                <span className="absolute bottom-1 h-1.5 w-1.5 rounded-full bg-fertile" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <LegendChip bg="#FBE9EE" color="#8F2B4C" swatch={<i className="h-2.5 w-2.5 rounded-full bg-rose" />} label="Period" />
        <LegendChip
          bg="#FFF3F6"
          color="#8F2B4C"
          swatch={<i className="h-2.5 w-2.5 rounded-full border-2 border-dashed border-rose" />}
          label="Expected"
        />
        <LegendChip
          bg="#DDF0EA"
          color="#2F6D59"
          swatch={<i className="h-2.5 w-2.5 rounded-full bg-fertile" />}
          label="Fertile (estimate)"
        />
      </div>
    </div>
  )
}

function LegendChip({
  bg,
  color,
  swatch,
  label,
}: {
  bg: string
  color: string
  swatch: React.ReactNode
  label: string
}) {
  return (
    <span
      className="flex h-[34px] items-center gap-2 rounded-full px-3.5 text-[13px] font-medium"
      style={{ background: bg, color }}
    >
      {swatch}
      {label}
    </span>
  )
}
