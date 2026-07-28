import { MSymbol } from './TrackerIcon'

/** Material 3 style switch (52×32, check glyph on the thumb when on). */
export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  label?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-8 w-[52px] shrink-0 rounded-full transition-colors disabled:opacity-40 ${
        checked ? 'bg-rose' : 'border-2 border-plum-soft/50 bg-line-soft'
      }`}
    >
      <span
        className={`absolute top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-white shadow transition-all ${
          checked ? 'left-[24px] h-6 w-6' : 'left-[5px] h-4 w-4'
        }`}
      >
        {checked && <MSymbol name="check" size={16} color="#C43D68" />}
      </span>
    </button>
  )
}
