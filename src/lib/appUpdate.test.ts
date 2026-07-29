import { describe, expect, it } from 'vitest'
import { parseBuildTag, updateFromRelease } from './appUpdate'

const release = {
  tag_name: 'build-12',
  name: 'Bloom build 12',
  html_url: 'https://github.com/Rishi-Goyal/flo-clone/releases/tag/build-12',
  assets: [
    { name: 'bloom-build-12.apk', browser_download_url: 'https://github.com/dl/bloom-build-12.apk' },
  ],
}

describe('parseBuildTag', () => {
  it('parses build tags', () => {
    expect(parseBuildTag('build-12')).toBe(12)
    expect(parseBuildTag('build-3')).toBe(3)
  })
  it('rejects everything else', () => {
    expect(parseBuildTag('v1.2.3')).toBeNull()
    expect(parseBuildTag('build-')).toBeNull()
    expect(parseBuildTag(undefined)).toBeNull()
    expect(parseBuildTag('')).toBeNull()
  })
})

describe('updateFromRelease', () => {
  it('offers an update when the release is newer', () => {
    const u = updateFromRelease(release, 10)
    expect(u).toEqual({
      build: 12,
      name: 'Bloom build 12',
      url: 'https://github.com/dl/bloom-build-12.apk',
    })
  })

  it('stays quiet when up to date or ahead', () => {
    expect(updateFromRelease(release, 12)).toBeNull()
    expect(updateFromRelease(release, 13)).toBeNull()
  })

  it('stays quiet when the current build is unknown (dev/web builds)', () => {
    expect(updateFromRelease(release, null)).toBeNull()
  })

  it('falls back to the release page when no APK asset exists', () => {
    const u = updateFromRelease({ ...release, assets: [] }, 10)
    expect(u?.url).toBe(release.html_url)
  })

  it('ignores malformed tags', () => {
    expect(updateFromRelease({ ...release, tag_name: 'v2' }, 10)).toBeNull()
  })
})
