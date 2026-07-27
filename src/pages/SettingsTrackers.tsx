import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useCategories, useTrackers } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { TRACKER_COLORS, TRACKER_ICONS } from '../lib/defaults'
import { PageHeader } from '../components/PageHeader'
import { TrackerIcon } from '../components/TrackerIcon'
import type { ChoiceOption, InputType, Tracker, TrackerCategory } from '../lib/types'

export function SettingsTrackers() {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const categories = useCategories(userId)
  const trackers = useTrackers(userId)
  const [editing, setEditing] = useState<Tracker | 'new' | null>(null)
  const [newCategoryFor, setNewCategoryFor] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')

  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['trackers', userId] })
    await qc.invalidateQueries({ queryKey: ['categories', userId] })
  }

  async function moveTracker(t: Tracker, dir: -1 | 1) {
    const siblings = (trackers.data ?? [])
      .filter((x) => x.category_id === t.category_id)
      .sort((a, b) => a.sort_order - b.sort_order)
    const idx = siblings.findIndex((x) => x.id === t.id)
    const other = siblings[idx + dir]
    if (!other) return
    await supabase.from('trackers').update({ sort_order: other.sort_order }).eq('id', t.id)
    await supabase.from('trackers').update({ sort_order: t.sort_order }).eq('id', other.id)
    await invalidate()
  }

  async function toggleActive(t: Tracker) {
    await supabase.from('trackers').update({ is_active: !t.is_active }).eq('id', t.id)
    await invalidate()
  }

  async function removeTracker(t: Tracker) {
    if (!confirm(`Delete "${t.name}" and all its logged history?`)) return
    await supabase.from('trackers').delete().eq('id', t.id)
    await invalidate()
  }

  async function renameCategory(cat: TrackerCategory) {
    const name = prompt('Category name', cat.name)
    if (!name?.trim() || name.trim() === cat.name) return
    await supabase.from('tracker_categories').update({ name: name.trim() }).eq('id', cat.id)
    await invalidate()
  }

  async function removeCategory(cat: TrackerCategory) {
    const inCat = (trackers.data ?? []).filter((t) => t.category_id === cat.id)
    if (inCat.length > 0) {
      alert('Move or delete this category’s trackers first.')
      return
    }
    if (!confirm(`Delete category "${cat.name}"?`)) return
    await supabase.from('tracker_categories').delete().eq('id', cat.id)
    await invalidate()
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    const name = newCategoryName.trim()
    if (!name) return
    await supabase.from('tracker_categories').insert({
      user_id: userId,
      name,
      sort_order: (categories.data?.length ?? 0),
    })
    setNewCategoryName('')
    setNewCategoryFor(false)
    await invalidate()
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <PageHeader title="Trackers" />

      <div className="space-y-5">
        {(categories.data ?? []).map((cat) => {
          const list = (trackers.data ?? [])
            .filter((t) => t.category_id === cat.id)
            .sort((a, b) => a.sort_order - b.sort_order)
          return (
            <section key={cat.id}>
              <div className="mb-2 flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => void renameCategory(cat)}
                  className="text-xs font-bold uppercase tracking-wide text-plum-soft"
                >
                  {cat.name} <Pencil size={10} className="ml-0.5 inline" />
                </button>
                <button
                  type="button"
                  onClick={() => void removeCategory(cat)}
                  className="p-1 text-plum-soft/60"
                  aria-label={`Delete category ${cat.name}`}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {list.map((t, i) => (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2.5 p-3.5 ${i > 0 ? 'border-t border-blush' : ''} ${
                      t.is_active ? '' : 'opacity-45'
                    }`}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                      style={{ background: `${t.color}22` }}
                    >
                      <TrackerIcon name={t.icon} size={16} color={t.color} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{t.name}</p>
                      <p className="text-[10px] text-plum-soft">
                        {t.input_type}
                        {t.system_key === 'period_flow' && ' · required for predictions'}
                      </p>
                    </div>
                    <div className="flex items-center">
                      <IconBtn label="Move up" onClick={() => void moveTracker(t, -1)}>
                        <ChevronUp size={15} />
                      </IconBtn>
                      <IconBtn label="Move down" onClick={() => void moveTracker(t, 1)}>
                        <ChevronDown size={15} />
                      </IconBtn>
                      <IconBtn label={t.is_active ? 'Hide' : 'Show'} onClick={() => void toggleActive(t)}>
                        {t.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                      </IconBtn>
                      <IconBtn label="Edit" onClick={() => setEditing(t)}>
                        <Pencil size={15} />
                      </IconBtn>
                      {t.system_key !== 'period_flow' && (
                        <IconBtn label="Delete" onClick={() => void removeTracker(t)}>
                          <Trash2 size={15} />
                        </IconBtn>
                      )}
                    </div>
                  </div>
                ))}
                {list.length === 0 && (
                  <p className="p-4 text-center text-xs text-plum-soft">No trackers in this category.</p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => setEditing('new')}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30"
      >
        <Plus size={16} /> New tracker
      </button>

      {newCategoryFor ? (
        <form onSubmit={addCategory} className="mt-3 flex gap-2">
          <input
            autoFocus
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="Category name"
            className="flex-1 rounded-2xl bg-white px-4 py-2.5 text-sm shadow-sm outline-none"
          />
          <button type="submit" className="rounded-2xl bg-rose px-4 text-sm font-semibold text-white">
            Add
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setNewCategoryFor(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blush-deep py-2.5 text-xs font-semibold text-plum-soft"
        >
          <Plus size={14} /> New category
        </button>
      )}

      {editing && (
        <TrackerEditor
          userId={userId!}
          tracker={editing === 'new' ? null : editing}
          categories={categories.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await invalidate()
          }}
        />
      )}
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="rounded-full p-1.5 text-plum-soft hover:bg-blush">
      {children}
    </button>
  )
}

// ------------------------------------------------------------ editor sheet

const TYPE_OPTIONS: Array<{ value: InputType; label: string; hint: string }> = [
  { value: 'boolean', label: 'Yes / no', hint: 'e.g. Cramps' },
  { value: 'scale', label: 'Scale', hint: 'e.g. Energy 1–5' },
  { value: 'choice', label: 'Single choice', hint: 'e.g. Flow intensity' },
  { value: 'multichoice', label: 'Multi choice', hint: 'e.g. Moods' },
  { value: 'number', label: 'Number', hint: 'e.g. Sleep hours' },
  { value: 'text', label: 'Free text', hint: 'e.g. Notes' },
]

function TrackerEditor({
  userId,
  tracker,
  categories,
  onClose,
  onSaved,
}: {
  userId: string
  tracker: Tracker | null
  categories: TrackerCategory[]
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const isFlow = tracker?.system_key === 'period_flow'
  const [name, setName] = useState(tracker?.name ?? '')
  const [icon, setIcon] = useState(tracker?.icon ?? 'Heart')
  const [color, setColor] = useState(tracker?.color ?? TRACKER_COLORS[0])
  const [type, setType] = useState<InputType>(tracker?.input_type ?? 'boolean')
  const [categoryId, setCategoryId] = useState(tracker?.category_id ?? categories[0]?.id ?? null)
  const [options, setOptions] = useState<ChoiceOption[]>(tracker?.config.options ?? [])
  const [min, setMin] = useState(tracker?.config.min ?? 1)
  const [max, setMax] = useState(tracker?.config.max ?? 5)
  const [minLabel, setMinLabel] = useState(tracker?.config.min_label ?? '')
  const [maxLabel, setMaxLabel] = useState(tracker?.config.max_label ?? '')
  const [unit, setUnit] = useState(tracker?.config.unit ?? '')
  const [newOption, setNewOption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function buildConfig() {
    if (type === 'scale') {
      return { min, max, ...(minLabel ? { min_label: minLabel } : {}), ...(maxLabel ? { max_label: maxLabel } : {}) }
    }
    if (type === 'choice' || type === 'multichoice') return { options }
    if (type === 'number') return unit ? { unit } : {}
    return {}
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const row = {
      name: name.trim(),
      icon,
      color,
      input_type: type,
      config: buildConfig(),
      category_id: categoryId,
    }
    const result = tracker
      ? await supabase.from('trackers').update(row).eq('id', tracker.id)
      : await supabase.from('trackers').insert({ ...row, user_id: userId, sort_order: 999 })
    setBusy(false)
    if (result.error) {
      setError(result.error.message)
      return
    }
    await onSaved()
  }

  const needsOptions = type === 'choice' || type === 'multichoice'

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-plum/40" onClick={onClose}>
      <form
        onSubmit={save}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-cream p-5 pb-8"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{tracker ? 'Edit tracker' : 'New tracker'}</h2>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-plum-soft" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            placeholder="e.g. Skin breakout"
            className="w-full rounded-2xl bg-white px-4 py-3 text-sm shadow-sm outline-none"
          />
        </label>

        <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Icon</span>
        <div className="mb-3 grid grid-cols-8 gap-1.5">
          {TRACKER_ICONS.map((ic) => (
            <button
              key={ic}
              type="button"
              onClick={() => setIcon(ic)}
              className={`flex h-9 items-center justify-center rounded-xl ${
                icon === ic ? 'bg-white shadow ring-2 ring-rose' : 'bg-white/60'
              }`}
              aria-label={ic}
            >
              <TrackerIcon name={ic} size={16} color={icon === ic ? color : '#8A6B7D'} />
            </button>
          ))}
        </div>

        <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Colour</span>
        <div className="mb-3 flex gap-2">
          {TRACKER_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={`h-8 w-8 rounded-full ${color === c ? 'ring-2 ring-plum ring-offset-2 ring-offset-cream' : ''}`}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
        </div>

        <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Category</span>
        <div className="mb-3 flex flex-wrap gap-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoryId(c.id)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${
                categoryId === c.id ? 'bg-rose text-white' : 'bg-white text-plum shadow-sm'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {!isFlow && (
          <>
            <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Type</span>
            <div className="mb-3 grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setType(o.value)}
                  className={`rounded-2xl p-3 text-left ${
                    type === o.value ? 'bg-rose text-white' : 'bg-white shadow-sm'
                  }`}
                >
                  <span className="block text-sm font-semibold">{o.label}</span>
                  <span className={`block text-[10px] ${type === o.value ? 'text-white/80' : 'text-plum-soft'}`}>
                    {o.hint}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}

        {needsOptions && (
          <div className="mb-3">
            <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Options</span>
            <div className="space-y-1.5">
              {options.map((o, i) => (
                <div key={i} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
                  <span className="flex-1 text-sm">{o.label}</span>
                  <button
                    type="button"
                    onClick={() => setOptions(options.filter((_, j) => j !== i))}
                    className="p-1 text-plum-soft"
                    aria-label={`Remove ${o.label}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-1.5 flex gap-2">
              <input
                value={newOption}
                onChange={(e) => setNewOption(e.target.value)}
                placeholder="Add option"
                className="flex-1 rounded-xl bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
              <button
                type="button"
                onClick={() => {
                  const label = newOption.trim()
                  if (!label) return
                  const value = label.toLowerCase().replace(/\s+/g, '_')
                  if (options.some((o) => o.value === value)) return
                  setOptions([...options, { value, label }])
                  setNewOption('')
                }}
                className="rounded-xl bg-blush px-3 text-sm font-semibold"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {type === 'scale' && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-plum-soft">Min</span>
              <input
                type="number"
                value={min}
                onChange={(e) => setMin(Number(e.target.value))}
                className="w-full rounded-xl bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-semibold text-plum-soft">Max</span>
              <input
                type="number"
                value={max}
                onChange={(e) => setMax(Number(e.target.value))}
                className="w-full rounded-xl bg-white px-3 py-2 text-sm shadow-sm outline-none"
              />
            </label>
            <input
              value={minLabel}
              onChange={(e) => setMinLabel(e.target.value)}
              placeholder="Low label (opt.)"
              className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm outline-none"
            />
            <input
              value={maxLabel}
              onChange={(e) => setMaxLabel(e.target.value)}
              placeholder="High label (opt.)"
              className="rounded-xl bg-white px-3 py-2 text-sm shadow-sm outline-none"
            />
          </div>
        )}

        {type === 'number' && (
          <label className="mb-3 block">
            <span className="mb-1.5 block text-xs font-semibold text-plum-soft">Unit (optional)</span>
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. h, ml, km"
              className="w-full rounded-2xl bg-white px-4 py-3 text-sm shadow-sm outline-none"
            />
          </label>
        )}

        {error && <p className="mb-2 text-xs text-rose-dark">{error}</p>}
        {needsOptions && options.length === 0 && (
          <p className="mb-2 text-xs text-plum-soft">Add at least one option.</p>
        )}
        <button
          type="submit"
          disabled={busy || !name.trim() || (needsOptions && options.length === 0) || (type === 'scale' && max <= min)}
          className="w-full rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30 disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save tracker'}
        </button>
      </form>
    </div>
  )
}
