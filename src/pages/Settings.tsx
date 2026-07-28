import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useLinkedProfileName, useOwnerLink } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { MSymbol } from '../components/TrackerIcon'
import { Toggle } from '../components/Toggle'

const SHARE_ROWS = [
  { key: 'share_phase', icon: 'favorite', label: 'Cycle phase & tips', sub: 'Where you are, and how to help' },
  { key: 'share_predictions', icon: 'event_upcoming', label: 'Predictions', sub: '“Period expected in ~10 days”' },
  { key: 'share_logs', icon: 'mood', label: 'Symptoms & mood', sub: 'Chips only, never your notes' },
] as const

export function Settings() {
  const { session, profile, refreshProfile, signOut } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const link = useOwnerLink(userId)
  const activeLink = link.data?.status === 'active' ? link.data : null
  const partnerName = useLinkedProfileName(activeLink?.partner_id)
  const [name, setName] = useState(profile?.display_name ?? '')
  const [editingName, setEditingName] = useState(false)

  async function saveName() {
    setEditingName(false)
    const trimmed = name.trim()
    if (!trimmed || trimmed === profile?.display_name) return
    await supabase.from('profiles').update({ display_name: trimmed }).eq('id', session!.user.id)
    await refreshProfile()
  }

  async function setFlag(key: string, value: boolean) {
    if (!link.data) return
    await supabase.from('partner_links').update({ [key]: value }).eq('id', link.data.id)
    await qc.invalidateQueries({ queryKey: ['owner-link', userId] })
  }

  const pName = partnerName.data ?? 'your partner'

  return (
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      <h1 className="mb-5 font-display text-[28px] font-medium tracking-[-.01em]">Settings</h1>

      {/* profile */}
      <div className="flex items-center gap-4 rounded-[28px] border border-line bg-white p-5">
        <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blush font-display text-xl font-semibold text-rose-dark">
          {(profile?.display_name ?? '?')[0]?.toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          {editingName ? (
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => void saveName()}
              onKeyDown={(e) => e.key === 'Enter' && void saveName()}
              className="w-full rounded-xl bg-line-soft px-3 py-1.5 text-[17px] font-semibold outline-none"
            />
          ) : (
            <p className="truncate text-[17px] font-semibold">{profile?.display_name ?? 'Set your name'}</p>
          )}
          <p className="mt-0.5 truncate text-sm text-plum-soft">{session?.user.email}</p>
        </div>
        <button
          type="button"
          aria-label="Edit name"
          onClick={() => setEditingName(true)}
          className="flex h-10 w-10 items-center justify-center rounded-full text-plum-soft hover:bg-blush"
        >
          <MSymbol name="edit" size={20} />
        </button>
      </div>

      {/* sharing switches */}
      <p className="mb-2 mt-6 ml-1 text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">
        {activeLink ? `What ${pName} sees` : 'Partner'}
      </p>
      {activeLink ? (
        <div className="overflow-hidden rounded-[28px] border border-line bg-white">
          {SHARE_ROWS.map(({ key, icon, label, sub }, i) => (
            <div key={key} className={`flex items-center gap-4 px-5 py-[18px] ${i > 0 ? 'border-t border-line-soft' : ''}`}>
              <MSymbol name={icon} size={22} color="#5F4353" />
              <div className="flex-1">
                <p className="text-base font-medium">{label}</p>
                <p className="mt-0.5 text-[13px] text-plum-soft">{sub}</p>
              </div>
              <Toggle checked={Boolean(activeLink[key])} onChange={(v) => void setFlag(key, v)} label={label} />
            </div>
          ))}
          <Link to="/settings/sharing" className="flex items-center gap-4 border-t border-line-soft px-5 py-[18px] active:bg-cream">
            <MSymbol name="tune" size={22} color="#5F4353" />
            <span className="flex-1 text-base font-medium">Advanced sharing</span>
            <MSymbol name="chevron_right" size={20} color="#8A6B7D" />
          </Link>
        </div>
      ) : (
        <Link
          to="/settings/partner"
          className="flex items-center gap-4 rounded-[28px] border border-line bg-white px-5 py-[18px] active:bg-cream"
        >
          <MSymbol name="favorite" size={22} color="#C43D68" />
          <span className="flex-1">
            <span className="block text-base font-medium">Invite your partner</span>
            <span className="mt-0.5 block text-[13px] text-plum-soft">
              They get a dashboard with your phase and daily tips
            </span>
          </span>
          <MSymbol name="chevron_right" size={20} color="#8A6B7D" />
        </Link>
      )}

      {/* app */}
      <p className="mb-2 mt-6 ml-1 text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">App</p>
      <div className="overflow-hidden rounded-[28px] border border-line bg-white">
        <Link to="/settings/trackers" className="flex items-center gap-4 px-5 py-[18px] active:bg-cream">
          <MSymbol name="tune" size={22} color="#5F4353" />
          <span className="flex-1 text-base font-medium">What I track</span>
          <MSymbol name="chevron_right" size={20} color="#8A6B7D" />
        </Link>
        <Link to="/settings/reminders" className="flex items-center gap-4 border-t border-line-soft px-5 py-[18px] active:bg-cream">
          <MSymbol name="notifications" size={22} color="#5F4353" />
          <span className="flex-1 text-base font-medium">Reminders</span>
          <MSymbol name="chevron_right" size={20} color="#8A6B7D" />
        </Link>
        <Link to="/settings/partner" className="flex items-center gap-4 border-t border-line-soft px-5 py-[18px] active:bg-cream">
          <MSymbol name="link" size={22} color="#5F4353" />
          <span className="flex-1 text-base font-medium">
            {activeLink ? `Linked with ${pName}` : 'Partner link'}
          </span>
          {activeLink?.accepted_at && (
            <span className="text-sm text-plum-soft">
              Since {new Date(activeLink.accepted_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          )}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-6 h-[52px] w-full rounded-full border border-line text-[15px] font-semibold text-rose-deep hover:bg-blush"
      >
        Sign out
      </button>
    </div>
  )
}
