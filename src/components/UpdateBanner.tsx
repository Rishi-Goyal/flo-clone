import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { checkForApkUpdate, type ApkUpdate } from '../lib/appUpdate'
import { isNative } from '../lib/supabase'
import { MSymbol } from './TrackerIcon'

/**
 * Top-of-screen update banner.
 * Web/PWA: shows when a new service worker is waiting; "Refresh" activates it.
 * Android APK: compares the baked-in CI build number with the latest GitHub
 * release and links to the new APK. Dismissable per version.
 */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true })

  const [apk, setApk] = useState<ApkUpdate | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isNative) return
    let cancelled = false
    const run = () => {
      void checkForApkUpdate().then((u) => {
        if (!cancelled && u && localStorage.getItem(`update-dismissed-${u.build}`) !== '1') setApk(u)
      })
    }
    run()
    const onVisible = () => document.visibilityState === 'visible' && run()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  // dev-only preview: /?test-update-banner=web|apk
  const test = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('test-update-banner') : null
  const showWeb = needRefresh || test === 'web'
  const showApk = !showWeb && (apk !== null || test === 'apk')

  if (!showWeb && !showApk) return null

  return (
    <div className="sticky top-0 z-30 -mt-[var(--sat)] flex items-center gap-3 bg-plum px-4 pb-2.5 pt-[calc(0.625rem_+_var(--sat))] text-white md:pl-[104px]">
      <MSymbol name="system_update" size={20} className="shrink-0" />
      <p className="flex-1 text-sm font-medium">
        {showWeb ? 'A new version of Bloom is ready.' : `Update available — ${apk?.name ?? 'new build'}.`}
      </p>
      {showWeb ? (
        <button
          type="button"
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true)
            void updateServiceWorker(true)
          }}
          className="h-9 shrink-0 rounded-full bg-white px-4 text-[13px] font-semibold text-plum disabled:opacity-60"
        >
          {refreshing ? 'Updating…' : 'Refresh'}
        </button>
      ) : (
        <>
          <a
            href={apk?.url ?? 'https://github.com/Rishi-Goyal/flo-clone/releases/latest'}
            target="_blank"
            rel="noreferrer"
            className="flex h-9 shrink-0 items-center rounded-full bg-white px-4 text-[13px] font-semibold text-plum"
          >
            Download
          </a>
          <button
            type="button"
            aria-label="Dismiss update banner"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15"
            onClick={() => {
              if (apk) localStorage.setItem(`update-dismissed-${apk.build}`, '1')
              setApk(null)
            }}
          >
            <MSymbol name="close" size={18} />
          </button>
        </>
      )}
    </div>
  )
}
