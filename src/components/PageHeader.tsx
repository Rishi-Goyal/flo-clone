import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

export function PageHeader({ title, backTo = '/settings' }: { title: string; backTo?: string }) {
  const navigate = useNavigate()
  return (
    <div className="mb-4 flex items-center gap-1">
      <button
        type="button"
        onClick={() => navigate(backTo)}
        className="-ml-2 rounded-full p-2 text-plum-soft hover:bg-blush"
        aria-label="Back"
      >
        <ChevronLeft size={22} />
      </button>
      <h1 className="text-xl font-bold">{title}</h1>
    </div>
  )
}
