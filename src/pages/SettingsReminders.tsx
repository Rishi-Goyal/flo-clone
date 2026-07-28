import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useReminders } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { MSymbol } from '../components/TrackerIcon'
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
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      <PageHeader title="Reminders" />

      <p className="mb-3 px-1 text-sm leading-relaxed text-ink-mute">
        Due reminders show as a banner on the Today screen. (Push notifications are a planned upgrade.)
      </p>

      <div className="space-y-3">
        {(reminders.data ?? []).map((r) => (
          <div key={r.id} className="rounded-[24px] border border-line bg-white px-5 py-4">
            <div className="flex items-center gap-3.5">
              <div className="flex-1">
                <p className="text-[15px] font-semibold">{r.title}</p>
                <p className="mt-0.5 text-[13px] text-plum-soft">
                  {r.time_of_day.slice(0, 5)} ·{' '}
                  {r.days_of_week.length === 7 ? 'every day' : r.days_of_week.map((d) => DAY_LABELS[d]).join(' ')}
                </p>
              </div>
              <Toggle checked={r.active} onChange={(v) => void toggleActive(r, v)} label={r.title} />
              <button
                type="button"
                onClick={() => void remove(r)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-plum-soft hover:bg-blush"
                aria-label="Delete reminder"
              >
                <MSymbol name="delete" size={20} />
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
          className="mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-dashed border-blush-deep text-[15px] font-semibold text-plum-soft hover:bg-blush/50"
        >
          <MSymbol name="add" size={20} /> Add reminder
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
    <form onSubmit={save} className="mt-4 space-y-3.5 rounded-[28px] border border-line bg-white p-5">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. Take the pill"
        required
        className="w-full rounded-2xl bg-line-soft px-4 py-3 text-[15px] outline-none"
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
            className={`h-11 flex-1 rounded-full text-[13px] font-semibold ${
              kind === value ? 'bg-rose text-white' : 'border border-line bg-white text-plum'
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
        className="w-full rounded-2xl bg-line-soft px-4 py-3 text-[15px] outline-none"
      />
      <div className="flex gap-1.5">
        {DAY_LABELS.map((label, d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d].sort()))}
            className={`h-10 flex-1 rounded-full text-[13px] font-bold ${
              days.includes(d) ? 'bg-rose text-white' : 'border border-line bg-white text-plum-soft'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex gap-2.5">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-full border border-line text-[15px] font-semibold">
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy || !title.trim() || days.length === 0}
          className="h-12 flex-1 rounded-full bg-rose text-[15px] font-semibold text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </form>
  )
}
