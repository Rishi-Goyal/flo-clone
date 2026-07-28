import type { CSSProperties } from 'react'

/** Material Symbols Rounded glyph. */
export function MSymbol({
  name,
  size = 24,
  fill = false,
  color,
  className = '',
  style,
}: {
  name: string
  size?: number
  fill?: boolean
  color?: string
  className?: string
  style?: CSSProperties
}) {
  return (
    <span
      aria-hidden
      className={`msr ${fill ? 'msr-fill' : ''} ${className}`}
      style={{ fontSize: size, color, ...style }}
    >
      {name}
    </span>
  )
}

/**
 * Tracker icons are stored in the DB as the original lucide names; this maps
 * them to Material Symbols so existing rows keep working after the redesign.
 * Unknown names fall back to a plain circle.
 */
const LUCIDE_TO_SYMBOL: Record<string, string> = {
  Droplets: 'water_drop',
  Zap: 'bolt',
  Brain: 'psychology',
  CircleDashed: 'blur_on',
  Smile: 'sentiment_satisfied',
  Frown: 'sentiment_dissatisfied',
  BatteryMedium: 'battery_3_bar',
  Moon: 'bedtime',
  NotebookPen: 'edit_note',
  Heart: 'favorite',
  HeartPulse: 'ecg_heart',
  Pill: 'pill',
  Coffee: 'coffee',
  Dumbbell: 'fitness_center',
  Utensils: 'restaurant',
  Thermometer: 'device_thermostat',
  Wind: 'air',
  CloudRain: 'rainy',
  Sparkles: 'auto_awesome',
  Flame: 'local_fire_department',
  Salad: 'nutrition',
  GlassWater: 'local_drink',
  Bed: 'bed',
  Activity: 'monitoring',
  Circle: 'circle',
}

export function trackerSymbol(name: string): string {
  return LUCIDE_TO_SYMBOL[name] ?? (/^[a-z0-9_]+$/.test(name) ? name : 'circle')
}

export function TrackerIcon({
  name,
  size = 18,
  color,
  fill = false,
  className,
}: {
  name: string
  size?: number
  color?: string
  fill?: boolean
  className?: string
}) {
  return <MSymbol name={trackerSymbol(name)} size={size} color={color} fill={fill} className={className} />
}
