import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import { AuthProvider } from './hooks/useAuth'
import { isNative, supabase } from './lib/supabase'
import './index.css'

// Service-worker registration lives in UpdateBanner (prompt-style updates).

// Android: the magic link deep-links back into the app with ?code=…
if (isNative) {
  void import('@capacitor/app').then(({ App: CapApp }) => {
    void CapApp.addListener('appUrlOpen', ({ url }) => {
      try {
        const code = new URL(url).searchParams.get('code')
        if (code) void supabase.auth.exchangeCodeForSession(code)
      } catch {
        /* not an auth callback */
      }
    })
  })
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
)
