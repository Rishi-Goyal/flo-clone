import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, HeartHandshake } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useOwnerLink } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'

export function SettingsPartner() {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const link = useOwnerLink(userId)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

  const partnerProfile = useQuery({
    queryKey: ['partner-profile', link.data?.partner_id],
    enabled: !!link.data?.partner_id,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', link.data!.partner_id!)
        .maybeSingle()
      return data
    },
  })

  async function createInvite() {
    setBusy(true)
    await supabase.from('partner_links').insert({ owner_id: userId })
    await qc.invalidateQueries({ queryKey: ['owner-link', userId] })
    setBusy(false)
  }

  async function revoke() {
    if (!link.data) return
    if (!confirm('Unlink your partner? They will immediately lose access to everything.')) return
    setBusy(true)
    await supabase.from('partner_links').update({ status: 'revoked' }).eq('id', link.data.id)
    await qc.invalidateQueries({ queryKey: ['owner-link', userId] })
    setBusy(false)
  }

  async function copyInvite() {
    const url = `${window.location.origin}/join/${link.data!.invite_code}`
    const text = `Join me on Bloom 🌸 Open this link to connect: ${url}`
    if (navigator.share) {
      try {
        await navigator.share({ text })
        return
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-24 pt-6">
      <PageHeader title="Partner" />

      {link.isLoading ? null : !link.data ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <HeartHandshake size={32} className="mx-auto text-rose" />
          <p className="mt-2 text-sm font-semibold">Invite your partner</p>
          <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-plum-soft">
            They'll get their own account with a dashboard showing your cycle phase and daily tips on how
            to support you. You control exactly what they can see.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createInvite()}
            className="mt-4 w-full rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30 disabled:opacity-50"
          >
            Generate invite code
          </button>
        </div>
      ) : link.data.status === 'pending' ? (
        <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold">Share this code with your partner</p>
          <p className="mt-3 rounded-2xl bg-blush py-4 font-mono text-2xl font-bold tracking-[0.25em]">
            {link.data.invite_code}
          </p>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied!' : 'Share invite link'}
          </button>
          <p className="mt-2 text-[11px] text-plum-soft">
            They can enter the code at sign-up, or open the link directly.
          </p>
          <button type="button" onClick={() => void revoke()} className="mt-3 text-xs font-medium text-rose-dark">
            Cancel invite
          </button>
        </div>
      ) : (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-fertile-soft">
              <HeartHandshake size={22} className="text-fertile" />
            </span>
            <div>
              <p className="text-sm font-semibold">
                Linked with {partnerProfile.data?.display_name ?? 'your partner'}
              </p>
              <p className="text-xs text-plum-soft">
                since {link.data.accepted_at ? new Date(link.data.accepted_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs leading-relaxed text-plum-soft">
            Manage what they can see in Settings → Sharing.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="mt-4 w-full rounded-2xl border border-blush-deep py-3 text-sm font-semibold text-rose-dark"
          >
            Unlink partner
          </button>
        </div>
      )}
    </div>
  )
}
