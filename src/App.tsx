import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import { BottomNav } from './components/BottomNav'
import { Login } from './pages/Login'
import { Onboarding } from './pages/Onboarding'
import { Join } from './pages/Join'
import { Today } from './pages/Today'
import { CalendarPage } from './pages/CalendarPage'
import { Insights } from './pages/Insights'
import { Settings } from './pages/Settings'
import { SettingsTrackers } from './pages/SettingsTrackers'
import { SettingsSharing } from './pages/SettingsSharing'
import { SettingsPartner } from './pages/SettingsPartner'
import { SettingsReminders } from './pages/SettingsReminders'
import { PartnerDashboard } from './pages/PartnerDashboard'
import { DevLogin } from './pages/DevLogin'

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-10 w-10 animate-pulse rounded-2xl bg-rose" />
    </div>
  )
}

function SetupNeeded() {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-xl font-bold">Almost there — connect Supabase</h1>
      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-plum-soft">
        <li>Create a free project at supabase.com</li>
        <li>
          Run <code className="rounded bg-blush px-1.5 py-0.5 text-xs">supabase/migrations/001_init.sql</code>{' '}
          in the SQL editor
        </li>
        <li>
          Copy <code className="rounded bg-blush px-1.5 py-0.5 text-xs">.env.example</code> to{' '}
          <code className="rounded bg-blush px-1.5 py-0.5 text-xs">.env.local</code> and fill in your
          project URL and anon key
        </li>
        <li>Restart the dev server</li>
      </ol>
    </div>
  )
}

/** Routes that require a session (and a chosen role for role-gated areas). */
function RequireRole({ role }: { role: 'tracker' | 'partner' }) {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (!profile?.role) return <Navigate to="/onboarding" replace />
  if (profile.role !== role) return <Navigate to={profile.role === 'tracker' ? '/today' : '/partner'} replace />
  return <Outlet />
}

function Home() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (!profile?.role) return <Navigate to="/onboarding" replace />
  return <Navigate to={profile.role === 'tracker' ? '/today' : '/partner'} replace />
}

function LoginRoute() {
  const { session, loading } = useAuth()
  if (loading) return <Splash />
  if (session) return <Navigate to="/" replace />
  return <Login />
}

function OnboardingRoute() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) return <Navigate to="/login" replace />
  if (profile?.role) return <Navigate to="/" replace />
  return <Onboarding />
}

function TrackerShell() {
  return (
    <div className="md:pl-[88px]">
      <Outlet />
      <BottomNav />
    </div>
  )
}

export default function App() {
  if (!isSupabaseConfigured) return <SetupNeeded />
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/onboarding" element={<OnboardingRoute />} />
        <Route path="/join/:code" element={<Join />} />
        {import.meta.env.DEV && <Route path="/dev-login" element={<DevLogin />} />}

        <Route element={<RequireRole role="tracker" />}>
          <Route element={<TrackerShell />}>
            <Route path="/today" element={<Today />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/settings/trackers" element={<SettingsTrackers />} />
            <Route path="/settings/sharing" element={<SettingsSharing />} />
            <Route path="/settings/partner" element={<SettingsPartner />} />
            <Route path="/settings/reminders" element={<SettingsReminders />} />
          </Route>
        </Route>

        <Route element={<RequireRole role="partner" />}>
          <Route path="/partner" element={<PartnerDashboard />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
