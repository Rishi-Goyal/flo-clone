import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { dayFlags, type CycleSummary } from '../lib/cycle'
import { todayIso } from '../lib/supabase'

/**
 * Month grid with cycle overlays:
 * solid rose = logged period · hatched rose = predicted period · rose outline = start window
 * teal tint = fertile window · teal dot = ovulation
 */
export function CalendarMonth({
  month,
  onMonthChange,
  summary,
  loggedFlowDates,
  onSelectDate,
}: {
  month: Date
  onMonthChange: (m: Date) => void
  summary: CycleSummary
  loggedFlowDates: Set<string>
  onSelectDate?: (iso: string) => void
}) {
  const today = todayIso()
  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) days.push(d)

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-full p-1.5 text-plum-soft hover:bg-blush"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="Previous month"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-bold">{format(month, 'MMMM yyyy')}</span>
        <button
          type="button"
          className="rounded-full p-1.5 text-plum-soft hover:bg-blush"
          onClick={() => onMonthChange(addMonths(month, 1))}
          aria-label="Next month"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-y-1 text-center">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i} className="pb-1 text-[10px] font-semibold text-plum-soft">
            {d}
          </span>
        ))}
        {days.map((d) => {
          const iso = format(d, 'yyyy-MM-dd')
          const inMonth = isSameMonth(d, month)
          const flags = dayFlags(summary, iso, today, loggedFlowDates)
          const isToday = iso === today

          let cellClass = 'text-plum'
          let cellStyle: React.CSSProperties = {}
          if (flags.isPeriod) {
            cellClass = 'text-white font-semibold'
            cellStyle = { background: '#E4557F' }
          } else if (flags.isPredictedPeriod) {
            cellClass = 'text-rose-dark font-semibold'
            cellStyle = {
              background:
                'repeating-linear-gradient(45deg, #FBE9EE, #FBE9EE 3px, #F6D3DD 3px, #F6D3DD 6px)',
            }
          } else if (flags.isFertile) {
            cellClass = 'text-[#3E8871] font-medium'
            cellStyle = { background: '#DDF0EA' }
          }

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate?.(iso)}
              className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm transition-transform active:scale-90 ${cellClass} ${
                inMonth ? '' : 'opacity-30'
              } ${isToday ? 'ring-2 ring-rose ring-offset-1' : ''} ${
                flags.isStartWindow && !flags.isPeriod && !flags.isPredictedPeriod ? 'ring-1 ring-blush-deep' : ''
              }`}
              style={cellStyle}
            >
              {format(d, 'd')}
              {flags.isOvulation && (
                <span className="absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-fertile" />
              )}
            </button>
          )
        })}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-plum-soft">
        <Legend swatch={<i className="h-2.5 w-2.5 rounded-full bg-rose" />} label="Period" />
        <Legend
          swatch={
            <i
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  'repeating-linear-gradient(45deg, #FBE9EE, #FBE9EE 2px, #F6D3DD 2px, #F6D3DD 4px)',
              }}
            />
          }
          label="Predicted"
        />
        <Legend swatch={<i className="h-2.5 w-2.5 rounded-full bg-fertile-soft" />} label="Fertile (est.)" />
        <Legend swatch={<i className="h-2.5 w-2.5 rounded-full bg-fertile" />} label="Ovulation (est.)" />
      </div>
    </div>
  )
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  )
}
