import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MSymbol } from '../components/TrackerIcon'
import { useAuth } from '../hooks/useAuth'
import { seedTrackerAccount } from '../hooks/useData'
import { supabase, todayIso } from '../lib/supabase'

type Step = 'role' | 'tracker' | 'partner'

export function Onboarding() {
  const { session, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('role')
  const [displayName, setDisplayName] = useState(profile?.display_name ?? '')
  const [lastPeriod, setLastPeriod] = useState('')
  const [periodLength, setPeriodLength] = useState(5)
  const [inviteCode, setInviteCode] = useState(localStorage.getItem('pending-invite') ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user.id

  async function saveName() {
    if (displayName.trim() && displayName.trim() !== profile?.display_name) {
      await supabase.from('profiles').update({ display_name: displayName.trim() }).eq('id', userId!)
    }
  }

  async function finishTracker(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      await saveName()
      await seedTrackerAccount(userId, lastPeriod || null, periodLength)
      await refreshProfile()
      navigate('/today', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  async function finishPartner(e: React.FormEvent) {
    e.preventDefault()
    if (!userId) return
    setBusy(true)
    setError(null)
    try {
      await saveName()
      const { error: err } = await supabase.rpc('accept_invite', { p_code: inviteCode.trim() })
      if (err) throw err
      localStorage.removeItem('pending-invite')
      await refreshProfile()
      navigate('/partner', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-bold">Welcome to Bloom</h1>

      {step === 'role' && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-plum-soft">How will you use the app?</p>
          <button
            type="button"
            onClick={() => setStep('tracker')}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blush">
              <MSymbol name="water_drop" size={24} fill color="#E4557F" />
            </span>
            <span>
              <span className="block text-sm font-semibold">I track my cycle</span>
              <span className="block text-xs text-plum-soft">Log periods & symptoms, see predictions</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep('partner')}
            className="flex w-full items-center gap-4 rounded-2xl bg-white p-5 text-left shadow-sm transition-transform active:scale-[0.98]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-fertile-soft">
              <MSymbol name="favorite" size={24} fill color="#6FB5A2" />
            </span>
            <span>
              <span className="block text-sm font-semibold">I'm the partner</span>
              <span className="block text-xs text-plum-soft">Follow along and get tips to support them</span>
            </span>
          </button>
        </div>
      )}

      {step === 'tracker' && (
        <form onSubmit={finishTracker} className="mt-6 space-y-4">
          <Field label="Your name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </Field>
          <Field label="When did your last period start? (optional)">
            <input
              type="date"
              value={lastPeriod}
              max={todayIso()}
              onChange={(e) => setLastPeriod(e.target.value)}
              className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </Field>
          {lastPeriod && (
            <Field label="How long does it usually last?">
              <div className="flex gap-2">
                {[3, 4, 5, 6, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setPeriodLength(n)}
                    className={`h-10 flex-1 rounded-xl text-sm font-semibold ${
                      periodLength === n ? 'bg-rose text-white' : 'bg-white text-plum shadow-sm'
                    }`}
                  >
                    {n}d
                  </button>
                ))}
              </div>
            </Field>
          )}
          {error && <p className="text-xs text-rose-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30 disabled:opacity-50"
          >
            {busy ? 'Setting up…' : 'Start tracking'}
          </button>
          <BackButton onClick={() => setStep('role')} />
        </form>
      )}

      {step === 'partner' && (
        <form onSubmit={finishPartner} className="mt-6 space-y-4">
          <Field label="Your name">
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Name"
              className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-sm outline-none focus:border-rose"
            />
          </Field>
          <Field label="Invite code from your partner">
            <input
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              placeholder="e.g. 4F7A9C2B"
              className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.2em] outline-none focus:border-rose"
            />
          </Field>
          <p className="text-xs leading-relaxed text-plum-soft">
            Your partner can generate a code in Settings → Partner. You'll only ever see what they choose
            to share.
          </p>
          {error && <p className="text-xs text-rose-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy || !inviteCode.trim()}
            className="w-full rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30 disabled:opacity-50"
          >
            {busy ? 'Linking…' : 'Link accounts'}
          </button>
          <BackButton onClick={() => setStep('role')} />
        </form>
      )}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-plum-soft">{label}</span>
      {children}
    </label>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-full py-1 text-center text-xs font-medium text-plum-soft">
      ← Back
    </button>
  )
}
