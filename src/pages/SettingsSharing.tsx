import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useOwnerLink, useTrackers } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { Toggle } from '../components/Toggle'
import { TrackerIcon } from '../components/TrackerIcon'
import type { PartnerLink } from '../lib/types'

const FLAGS: Array<{ key: keyof PartnerLink; label: string; sub: string }> = [
  { key: 'share_phase', label: 'Cycle phase', sub: 'Current phase, cycle day, and daily tips' },
  { key: 'share_predictions', label: 'Predictions', sub: 'Days until the next period' },
  { key: 'share_period_dates', label: 'Period dates', sub: 'Exact predicted dates' },
  { key: 'share_logs', label: 'Symptoms & mood', sub: 'Only the trackers you tick below' },
  { key: 'share_notes', label: 'Notes', sub: 'Free-text trackers (requires symptoms sharing)' },
]

export function SettingsSharing() {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const link = useOwnerLink(userId)
  const trackers = useTrackers(userId)

  async function setFlag(key: string, value: boolean) {
    if (!link.data) return
    await supabase.from('partner_links').update({ [key]: value }).eq('id', link.data.id)
    await qc.invalidateQueries({ queryKey: ['owner-link', userId] })
  }

  async function setTrackerShared(trackerId: string, value: boolean) {
    await supabase.from('trackers').update({ shared_with_partner: value }).eq('id', trackerId)
    await qc.invalidateQueries({ queryKey: ['trackers', userId] })
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <PageHeader title="Sharing" />

      {!link.data || link.data.status === 'revoked' ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold">No partner linked yet</p>
          <p className="mt-1 text-xs text-plum-soft">
            Sharing controls appear once you've{' '}
            <Link to="/settings/partner" className="font-medium text-rose">
              invited your partner
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 px-1 text-xs leading-relaxed text-plum-soft">
            These switches take effect instantly — anything turned off disappears from your partner's app
            immediately (enforced by the database, not just the UI).
          </p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
            {FLAGS.map(({ key, label, sub }, i) => (
              <div key={key} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-blush' : ''}`}>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{label}</p>
                  <p className="text-xs text-plum-soft">{sub}</p>
                </div>
                <Toggle
                  checked={Boolean(link.data![key])}
                  onChange={(v) => void setFlag(key as string, v)}
                />
              </div>
            ))}
          </div>

          {link.data.share_logs && (
            <>
              <h2 className="mb-2 mt-5 px-1 text-xs font-bold uppercase tracking-wide text-plum-soft">
                Shared trackers
              </h2>
              <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
                {(trackers.data ?? [])
                  .filter((t) => t.is_active)
                  .map((t, i) => (
                    <div key={t.id} className={`flex items-center gap-3 p-4 ${i > 0 ? 'border-t border-blush' : ''}`}>
                      <TrackerIcon name={t.icon} size={17} color={t.color} />
                      <span className="flex-1 text-sm font-medium">{t.name}</span>
                      <Toggle
                        checked={t.shared_with_partner}
                        onChange={(v) => void setTrackerShared(t.id, v)}
                      />
                    </div>
                  ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
