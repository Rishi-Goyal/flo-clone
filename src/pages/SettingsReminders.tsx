import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useReminders } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import type { Reminder } from '../lib/types'

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // index = JS getDay()

export function SettingsReminders() {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const reminders = useReminders(userId)
  const [adding, setAdding] = useState(false)

  const invalidate = () => qc.invalidateQueries({ queryKey: ['reminders', userId] })

  async function toggleActive(r: Reminder, active: boolean) {
    await supabase.from('reminders').update({ active }).eq('id', r.id)
    await invalidate()
  }

  async function remove(r: Reminder) {
    if (!confirm(`Delete reminder "${r.title}"?`)) return
    await supabase.from('reminders').delete().eq('id', r.id)
    await invalidate()
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <PageHeader title="Reminders" />

      <p className="mb-3 px-1 text-xs leading-relaxed text-plum-soft">
        Due reminders show as a banner on the Today screen. (Push notifications are a planned upgrade.)
      </p>

      <div className="space-y-2.5">
        {(reminders.data ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold">{r.title}</p>
                <p className="text-xs text-plum-soft">
                  {r.time_of_day.slice(0, 5)} ·{' '}
                  {r.days_of_week.length === 7
                    ? 'every day'
                    : r.days_of_week.map((d) => DAY_LABELS[d]).join(' ')}
                </p>
              </div>
              <Toggle checked={r.active} onChange={(v) => void toggleActive(r, v)} />
              <button
                type="button"
                onClick={() => void remove(r)}
                className="rounded-full p-1.5 text-plum-soft hover:bg-blush"
                aria-label="Delete reminder"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {adding ? (
        <ReminderForm
          userId={userId!}
          onDone={() => {
            setAdding(false)
            void invalidate()
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-blush-deep py-3 text-sm font-semibold text-plum-soft"
        >
          <Plus size={16} /> Add reminder
        </button>
      )}
    </div>
  )
}

function ReminderForm({
  userId,
  onDone,
  onCancel,
}: {
  userId: string
  onDone: () => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState('')
  const [kind, setKind] = useState<Reminder['kind']>('medication')
  const [time, setTime] = useState('09:00')
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6])
  const [busy, setBusy] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    await supabase.from('reminders').insert({
      user_id: userId,
      title: title.trim(),
      kind,
      time_of_day: time,
      days_of_week: days,
    })
    setBusy(false)
    onDone()
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Take the pill"
        required
        className="w-full rounded-xl bg-blush px-3 py-2.5 text-sm outline-none"
      />
      <div className="flex gap-2">
        {(
          [
            ['birth_control', 'Birth control'],
            ['medication', 'Medication'],
            ['custom', 'Other'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setKind(value)}
            className={`flex-1 rounded-xl py-2 text-xs font-semibold ${
              kind === value ? 'bg-rose text-white' : 'bg-blush text-plum'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full rounded-xl bg-blush px-3 py-2.5 text-sm outline-none"
      />
      <div className="flex gap-1.5">
        {DAY_LABELS.map((label, d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))}
            className={`h-9 flex-1 rounded-xl text-xs font-bold ${
              days.includes(d) ? 'bg-rose text-white' : 'bg-blush text-plum-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl bg-blush py-2.5 text-sm font-semibold">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim() || days.length === 0}
          className="flex-1 rounded-xl bg-rose py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </form>
  )
}
