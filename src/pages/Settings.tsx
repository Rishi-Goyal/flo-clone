import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BellRing, ChevronRight, HeartHandshake, LogOut, Share2, SlidersHorizontal } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

const rows = [
  { to: '/settings/trackers', label: 'Trackers', sub: 'Add, rename, and customise what you log', icon: SlidersHorizontal },
  { to: '/settings/sharing', label: 'Sharing', sub: 'Control what your partner can see', icon: Share2 },
  { to: '/settings/partner', label: 'Partner', sub: 'Invite or manage your partner', icon: HeartHandshake },
  { to: '/settings/reminders', label: 'Reminders', sub: 'Medication and birth control', icon: BellRing },
]

export function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth()
  const [name, setName] = useState(profile?.display_name ?? '')

  async function saveName() {
    const trimmed = name.trim()
    if (!trimmed || trimmed === profile?.display_name) return
    await supabase.from('profiles').update({ display_name: trimmed }).eq('id', session!.user.id)
    await refreshProfile()
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <h1 className="mb-4 text-xl font-bold">Settings</h1>

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-plum-soft">Your name</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => void saveName()}
          className="mt-1 w-full rounded-xl bg-blush px-3 py-2 text-sm outline-none"
        />
        <p className="mt-2 text-[11px] text-plum-soft">{session?.user.email}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-sm">
        {rows.map(({ to, label, sub, icon: Icon }, i) => (
          <Link
            key={to}
            to={to}
            className={`flex items-center gap-3 p-4 active:bg-blush ${i > 0 ? 'border-t border-blush' : ''}`}
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blush">
              <Icon size={18} className="text-rose" />
            </span>
            <span className="flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-plum-soft">{sub}</span>
            </span>
            <ChevronRight size={18} className="text-plum-soft" />
          </Link>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-rose-dark shadow-sm"
      >
        <LogOut size={16} /> Sign out
      </button>
    </div>
  )
}
