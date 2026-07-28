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
  { key: 'share_phase', label: 'Cycle phase & tips', sub: 'Current phase, cycle day, and daily tips' },
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
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      <PageHeader title="Sharing" />

      {!link.data || link.data.status === 'revoked' ? (
        <div className="rounded-[28px] border border-line bg-white p-6 text-center">
          <p className="text-[15px] font-semibold">No partner linked yet</p>
          <p className="mt-1.5 text-sm text-plum-soft">
            Sharing controls appear once you've{' '}
            <Link to="/settings/partner" className="font-medium text-rose-dark">
              invited your partner
            </Link>
            .
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 px-1 text-sm leading-relaxed text-ink-mute">
            These switches take effect instantly — anything turned off disappears from your partner's app
            immediately (enforced by the database, not just the UI).
          </p>
          <div className="overflow-hidden rounded-[28px] border border-line bg-white">
            {FLAGS.map(({ key, label, sub }, i) => (
              <div key={key} className={`flex items-center gap-4 px-5 py-[18px] ${i > 0 ? 'border-t border-line-soft' : ''}`}>
                <div className="flex-1">
                  <p className="text-base font-medium">{label}</p>
                  <p className="mt-0.5 text-[13px] text-plum-soft">{sub}</p>
                </div>
                <Toggle checked={Boolean(link.data![key])} onChange={(v) => void setFlag(key as string, v)} label={label} />
              </div>
            ))}
          </div>

          {link.data.share_logs && (
            <>
              <h2 className="mb-2 mt-6 ml-1 text-[13px] font-bold uppercase tracking-[.06em] text-plum-soft">
                Shared trackers
              </h2>
              <div className="overflow-hidden rounded-[28px] border border-line bg-white">
                {(trackers.data ?? [])
                  .filter((t) => t.is_active)
                  .map((t, i) => (
                    <div key={t.id} className={`flex items-center gap-4 px-5 py-4 ${i > 0 ? 'border-t border-line-soft' : ''}`}>
                      <TrackerIcon name={t.icon} size={20} color={t.color} />
                      <span className="flex-1 text-[15px] font-medium">{t.name}</span>
                      <Toggle checked={t.shared_with_partner} onChange={(v) => void setTrackerShared(t.id, v)} label={t.name} />
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
