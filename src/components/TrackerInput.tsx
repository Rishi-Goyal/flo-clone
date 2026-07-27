import { useEffect, useState } from 'react'
import type { LogValue, Tracker } from '../lib/types'
import { TrackerIcon } from './TrackerIcon'

/**
 * Renders the right input for a tracker's input_type and reports value changes.
 * `value === null` means "not logged today".
 */
export function TrackerInput({
  tracker,
  value,
  onChange,
  disabled,
}: {
  tracker: Tracker
  value: LogValue | null
  onChange: (value: LogValue | null) => void
  disabled?: boolean
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span
          className="flex h-7 w-7 items-center justify-center rounded-full"
          style={{ background: `${tracker.color}22` }}
        >
          <TrackerIcon name={tracker.icon} size={15} color={tracker.color} />
        </span>
        <span className="text-sm font-semibold">{tracker.name}</span>
      </div>
      <Control tracker={tracker} value={value} onChange={onChange} disabled={disabled} />
    </div>
  )
}

function Control({
  tracker,
  value,
  onChange,
  disabled,
}: {
  tracker: Tracker
  value: LogValue | null
  onChange: (value: LogValue | null) => void
  disabled?: boolean
}) {
  const cfg = tracker.config

  switch (tracker.input_type) {
    case 'boolean':
      return (
        <div className="flex gap-2">
          <Chip
            active={value === true}
            color={tracker.color}
            onClick={() => onChange(value === true ? null : true)}
            disabled={disabled}
          >
            Yes
          </Chip>
        </div>
      )

    case 'choice':
      return (
        <div className="flex flex-wrap gap-2">
          {(cfg.options ?? []).map((o) => (
            <Chip
              key={o.value}
              active={value === o.value}
              color={tracker.color}
              onClick={() => onChange(value === o.value ? null : o.value)}
              disabled={disabled}
            >
              {o.label}
            </Chip>
          ))}
        </div>
      )

    case 'multichoice': {
      const selected = Array.isArray(value) ? value : []
      return (
        <div className="flex flex-wrap gap-2">
          {(cfg.options ?? []).map((o) => {
            const active = selected.includes(o.value)
            return (
              <Chip
                key={o.value}
                active={active}
                color={tracker.color}
                onClick={() => {
                  const next = active ? selected.filter((v) => v !== o.value) : [...selected, o.value]
                  onChange(next.length ? next : null)
                }}
                disabled={disabled}
              >
                {o.label}
              </Chip>
            )
          })}
        </div>
      )
    }

    case 'scale': {
      const min = cfg.min ?? 1
      const max = cfg.max ?? 5
      const steps = Array.from({ length: max - min + 1 }, (_, i) => min + i)
      return (
        <div>
          <div className="flex gap-2">
            {steps.map((n) => (
              <button
                key={n}
                type="button"
                disabled={disabled}
                onClick={() => onChange(value === n ? null : n)}
                className={`h-9 flex-1 rounded-xl text-sm font-semibold transition-colors ${
                  typeof value === 'number' && value >= n ? 'text-white' : 'bg-blush text-plum-soft'
                }`}
                style={typeof value === 'number' && value >= n ? { background: tracker.color } : undefined}
              >
                {n}
              </button>
            ))}
          </div>
          {(cfg.min_label || cfg.max_label) && (
            <div className="mt-1 flex justify-between text-[10px] text-plum-soft">
              <span>{cfg.min_label}</span>
              <span>{cfg.max_label}</span>
            </div>
          )}
        </div>
      )
    }

    case 'number':
      return <NumberControl value={value} unit={cfg.unit} color={tracker.color} onChange={onChange} disabled={disabled} />

    case 'text':
      return <TextControl value={value} onChange={onChange} disabled={disabled} />
  }
}

function Chip({
  active,
  color,
  onClick,
  children,
  disabled,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'text-white' : 'bg-blush text-plum'
      }`}
      style={active ? { background: color } : undefined}
    >
      {children}
    </button>
  )
}

function NumberControl({
  value,
  unit,
  color,
  onChange,
  disabled,
}: {
  value: LogValue | null
  unit?: string
  color: string
  onChange: (v: LogValue | null) => void
  disabled?: boolean
}) {
  const n = typeof value === 'number' ? value : null
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        className="h-9 w-9 rounded-xl bg-blush text-lg font-bold"
        onClick={() => onChange(n === null ? 0 : Math.max(0, +(n - 0.5).toFixed(1)) || null)}
      >
        −
      </button>
      <span className="min-w-16 text-center text-lg font-bold" style={{ color: n !== null ? color : '#8A6B7D' }}>
        {n !== null ? `${n}${unit ? ` ${unit}` : ''}` : '—'}
      </span>
      <button
        type="button"
        disabled={disabled}
        className="h-9 w-9 rounded-xl bg-blush text-lg font-bold"
        onClick={() => onChange(n === null ? 1 : +(n + 0.5).toFixed(1))}
      >
        +
      </button>
    </div>
  )
}

function TextControl({
  value,
  onChange,
  disabled,
}: {
  value: LogValue | null
  onChange: (v: LogValue | null) => void
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(typeof value === 'string' ? value : '')
  useEffect(() => {
    setDraft(typeof value === 'string' ? value : '')
  }, [value])
  return (
    <textarea
      value={draft}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        const trimmed = draft.trim()
        if (trimmed !== (typeof value === 'string' ? value : '')) onChange(trimmed || null)
      }}
      placeholder="Write anything…"
      rows={2}
      className="w-full resize-none rounded-xl bg-blush p-3 text-sm outline-none placeholder:text-plum-soft/60"
    />
  )
}
