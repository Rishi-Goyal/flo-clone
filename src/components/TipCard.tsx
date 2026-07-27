import { Lightbulb } from 'lucide-react'

export function TipCard({ tip, title = 'Tip of the day' }: { tip: string; title?: string }) {
  return (
    <div className="flex gap-3 rounded-2xl bg-peach-soft p-4">
      <Lightbulb size={20} className="mt-0.5 shrink-0 text-peach" fill="#F7A98C" />
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-plum-soft">{title}</p>
        <p className="mt-0.5 text-sm leading-relaxed">{tip}</p>
      </div>
    </div>
  )
}
