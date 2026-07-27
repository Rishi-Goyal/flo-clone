import { icons, Circle } from 'lucide-react'

export function TrackerIcon({
  name,
  size = 18,
  color,
  className,
}: {
  name: string
  size?: number
  color?: string
  className?: string
}) {
  const Icon = (icons as Record<string, typeof Circle>)[name] ?? Circle
  return <Icon size={size} color={color} className={className} strokeWidth={2} />
}
