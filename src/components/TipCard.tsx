import { MSymbol } from './TrackerIcon'

export function TipCard({ tip, title = "Today's nudge" }: { tip: string; title?: string }) {
  return (
    <div className="flex gap-3.5 rounded-3xl border border-line bg-white p-5">
      <MSymbol name="wb_twilight" size={22} color="#E08A6A" className="mt-0.5 shrink-0" />
      <div>
        <p className="text-[13px] font-semibold uppercase tracking-[.03em] text-plum-soft">{title}</p>
        <p className="mt-1 text-[15px] leading-relaxed">{tip}</p>
      </div>
    </div>
  )
}
