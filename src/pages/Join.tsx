import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'

/** Invite deep link: /join/:code — stores the code, then accepts once signed in. */
export function Join() {
  const { code } = useParams()
  const { session, loading, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  useEffect(() => {
    if (code) localStorage.setItem('pending-invite', code.toUpperCase())
  }, [code])

  useEffect(() => {
    if (loading || attempted.current) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    attempted.current = true
    void (async () => {
      const { error: err } = await supabase.rpc('accept_invite', { p_code: code ?? '' })
      if (err) {
        setError(err.message)
        return
      }
      localStorage.removeItem('pending-invite')
      await refreshProfile()
      navigate('/partner', { replace: true })
    })()
  }, [loading, session, code, navigate, refreshProfile])

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      {error ? (
        <div className="max-w-xs rounded-2xl bg-white p-5 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-dark">Couldn't accept invite</p>
          <p className="mt-1 text-xs text-plum-soft">{error}</p>
          <button type="button" className="mt-3 text-xs font-medium text-rose" onClick={() => navigate('/')}>
            Go home
          </button>
        </div>
      ) : (
        <p className="text-sm text-plum-soft">Linking accounts…</p>
      )}
    </div>
  )
}
