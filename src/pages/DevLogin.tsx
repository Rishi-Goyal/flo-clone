import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * DEV-only sign-in used by scripts/dev-login.mjs for testing user/partner
 * flows without email round-trips. The route is only registered when
 * import.meta.env.DEV is true, so it never exists in production builds.
 */
export function DevLogin() {
  const [params] = useSearchParams()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true
    const tokenHash = params.get('token_hash')
    if (!tokenHash) {
      setError('Missing token_hash — generate a URL with `npm run dev:login`.')
      return
    }
    void (async () => {
      await supabase.auth.signOut() // switching test users should be clean
      const { error: err } = await supabase.auth.verifyOtp({ type: 'magiclink', token_hash: tokenHash })
      if (err) {
        setError(err.message)
        return
      }
      // Hard reload: switching users in-place leaves stale profile/query state
      window.location.replace('/')
    })()
  }, [params])

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <p className="text-sm text-plum-soft">{error ?? 'Signing in test user…'}</p>
    </div>
  )
}
