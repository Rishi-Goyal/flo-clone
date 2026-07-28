import { useNavigate } from 'react-router-dom'
import { MSymbol } from './TrackerIcon'

export function PageHeader({ title, backTo = '/settings' }: { title: string; backTo?: string }) {
  const navigate = useNavigate()
  return (
    <div className="mb-5 flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-soft hover:bg-blush"
        aria-label="Back"
      >
        <MSymbol name="arrow_back" size={22} />
      </button>
      <h1 className="font-display text-[28px] font-medium tracking-[-.01em]">{title}</h1>
    </div>
  )
}
