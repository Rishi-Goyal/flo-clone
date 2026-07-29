// Native (APK) update check against the public GitHub releases feed.
// CI bakes VITE_BUILD_NUMBER (the Actions run number) into the bundle; the
// release workflow tags each build `build-<run number>` with the APK attached.

const RELEASES_LATEST = 'https://api.github.com/repos/Rishi-Goyal/flo-clone/releases/latest'
const CHECK_EVERY_MS = 6 * 60 * 60 * 1000 // 6h between checks

export const CURRENT_BUILD: number | null = (() => {
  const n = Number(import.meta.env.VITE_BUILD_NUMBER)
  return Number.isInteger(n) && n > 0 ? n : null
})()

export interface ApkUpdate {
  build: number
  name: string
  /** direct APK download when present, else the release page */
  url: string
}

/** "build-12" → 12; anything else → null */
export function parseBuildTag(tag: string | undefined | null): number | null {
  const m = /^build-(\d+)$/.exec(tag ?? '')
  return m ? Number(m[1]) : null
}

export function updateFromRelease(
  release: {
    tag_name?: string
    name?: string
    html_url?: string
    assets?: Array<{ name?: string; browser_download_url?: string }>
  },
  currentBuild: number | null,
): ApkUpdate | null {
  const build = parseBuildTag(release.tag_name)
  if (build === null || currentBuild === null || build <= currentBuild) return null
  const apk = release.assets?.find((a) => a.name?.endsWith('.apk'))
  const url = apk?.browser_download_url ?? release.html_url
  if (!url) return null
  return { build, name: release.name ?? `Build ${build}`, url }
}

export async function checkForApkUpdate(): Promise<ApkUpdate | null> {
  if (CURRENT_BUILD === null) return null
  const last = Number(localStorage.getItem('update-checked-at') ?? 0)
  const cached = localStorage.getItem('update-latest')
  if (Date.now() - last < CHECK_EVERY_MS && cached) {
    try {
      return updateFromRelease(JSON.parse(cached), CURRENT_BUILD)
    } catch {
      /* fall through to a fresh check */
    }
  }
  try {
    const res = await fetch(RELEASES_LATEST, { headers: { Accept: 'application/vnd.github+json' } })
    if (!res.ok) return null
    const release = (await res.json()) as Parameters<typeof updateFromRelease>[0]
    localStorage.setItem('update-checked-at', String(Date.now()))
    localStorage.setItem('update-latest', JSON.stringify(release))
    return updateFromRelease(release, CURRENT_BUILD)
  } catch {
    return null // offline etc. — never bother the user about a failed check
  }
}
