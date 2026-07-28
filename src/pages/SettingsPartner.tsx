import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../hooks/useAuth'
import { useLinkedProfileName, useOwnerLink } from '../hooks/useData'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/PageHeader'
import { MSymbol } from '../components/TrackerIcon'

export function SettingsPartner() {
  const { session } = useAuth()
  const userId = session?.user.id
  const qc = useQueryClient()
  const link = useOwnerLink(userId)
  const partnerName = useLinkedProfileName(link.data?.partner_id)
  const [copied, setCopied] = useState(false)
  const [busy, setBusy] = useState(false)

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
    <div className="mx-auto max-w-md px-5 pb-32 pt-5 md:pb-10">
      <PageHeader title="Partner" />

      {link.isLoading ? null : !link.data ? (
        <div className="rounded-[28px] border border-line bg-white p-6 text-center">
          <MSymbol name="favorite" size={32} fill color="#E4557F" />
          <p className="mt-2 font-display text-lg font-medium">Invite your partner</p>
          <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-ink-mute">
            They'll get their own account with a dashboard showing your cycle phase and daily tips on how
            to support you. You control exactly what they can see.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void createInvite()}
            className="mt-5 h-14 w-full rounded-full bg-rose font-display text-base font-semibold text-white disabled:opacity-50"
          >
            Generate invite code
          </button>
        </div>
      ) : link.data.status === 'pending' ? (
        <div className="rounded-[28px] border border-line bg-white p-6 text-center">
          <p className="text-[15px] font-semibold">Share this code with your partner</p>
          <p className="mt-3 rounded-3xl bg-blush py-4 font-mono text-2xl font-bold tracking-[0.25em] text-rose-deep">
            {link.data.invite_code}
          </p>
          <button
            type="button"
            onClick={() => void copyInvite()}
            className="mt-4 flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-rose font-display text-base font-semibold text-white"
          >
            <MSymbol name={copied ? 'check' : 'content_copy'} size={20} />
            {copied ? 'Copied!' : 'Share invite link'}
          </button>
          <p className="mt-2.5 text-[13px] text-plum-soft">
            They can enter the code at sign-up, or open the link directly.
          </p>
          <button type="button" onClick={() => void revoke()} className="mt-4 text-sm font-medium text-rose-deep">
            Cancel invite
          </button>
        </div>
      ) : (
        <div className="rounded-[28px] border border-line bg-white p-6">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-fertile-soft">
              <MSymbol name="favorite" size={22} fill color="#2F6D59" />
            </span>
            <div>
              <p className="text-[15px] font-semibold">
                Linked with {partnerName.data ?? 'your partner'}
              </p>
              <p className="text-sm text-plum-soft">
                since {link.data.accepted_at ? new Date(link.data.accepted_at).toLocaleDateString() : '—'}
              </p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-mute">
            Manage what they can see in Settings → Sharing.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void revoke()}
            className="mt-5 h-[52px] w-full rounded-full border border-line text-[15px] font-semibold text-rose-deep hover:bg-blush"
          >
            Unlink partner
          </button>
        </div>
      )}
    </div>
  )
}
