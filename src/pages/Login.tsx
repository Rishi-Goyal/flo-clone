import { useState } from 'react'
import { MSymbol } from '../components/TrackerIcon'
import { authRedirectUrl, supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: authRedirectUrl() },
    })
    setBusy(false)
    if (err) setError(err.message)
    else setSent(true)
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    setBusy(false)
    if (err) setError(err.message)
    // success: onAuthStateChange routes onwards automatically
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-[22px] bg-rose">
        <MSymbol name="water_drop" size={34} fill color="#FFF8F4" />
      </div>
      <h1 className="mt-4 font-display text-[28px] font-medium">Bloom</h1>
      <p className="mt-1 text-sm text-plum-soft">Cycle tracking, together.</p>

      {sent ? (
        <div className="mt-8 w-full max-w-xs rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold">Check your email 💌</p>
          <p className="mt-1.5 text-xs leading-relaxed text-plum-soft">
            We sent a sign-in link to <span className="font-medium text-plum">{email}</span>. Open it
            on this device to continue. Got a 6-digit code instead? Enter it below.
          </p>
          <form onSubmit={verifyCode} className="mt-3 space-y-2">
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-rose"
            />
            {error && <p className="text-xs text-rose-dark">{error}</p>}
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="w-full rounded-2xl bg-rose py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? 'Verifying…' : 'Verify code'}
            </button>
          </form>
          <button type="button" className="mt-3 text-xs font-medium text-rose" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </div>
      ) : (
        <form onSubmit={sendLink} className="mt-8 w-full max-w-xs space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full rounded-2xl border border-blush-deep bg-white px-4 py-3 text-sm outline-none focus:border-rose"
          />
          {error && <p className="text-xs text-rose-dark">{error}</p>}
          <button
            type="submit"
            disabled={busy || !email.trim()}
            className="w-full rounded-2xl bg-rose py-3 text-sm font-semibold text-white shadow-lg shadow-rose/30 transition-opacity disabled:opacity-50"
          >
            {busy ? 'Sending…' : 'Send sign-in link'}
          </button>
          <p className="text-center text-[11px] leading-relaxed text-plum-soft">
            No passwords — we email you a magic link. First sign-in creates your account.
          </p>
        </form>
      )}
    </div>
  )
}
