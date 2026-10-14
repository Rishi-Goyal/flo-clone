// Bridge to the native Android home-screen widget (BloomWidgetProvider).
// The app pushes a small snapshot; the widget recomputes day-relative values
// from the dates itself, so it stays correct without the app being opened.
import { registerPlugin } from '@capacitor/core'
import { isNative } from './supabase'
import type { CycleSummary } from './cycle'
import type { Phase } from './types'

interface BloomWidgetPlugin {
  update(options: { json: string }): Promise<void>
}

const BloomWidget = registerPlugin<BloomWidgetPlugin>('BloomWidget')

export type WidgetSnapshot =
  | { role: 'none' }
  | {
      role: 'tracker'
      lastPeriodStart: string
      avgPeriodLength: number
      predictedNextStart?: string
      ovulationDate?: string
      windowDays: number
      confidence: string
    }
  | {
      role: 'partner'
      ownerName: string
      phase: Phase
      cycleDay: number
      asOf: string
      daysUntil?: number
      windowDays?: number
      confidence?: string
    }

let lastJson = ''

/** Push a snapshot to the widget (no-op on web; skips identical updates). */
export function updateWidget(snapshot: WidgetSnapshot): void {
  if (!isNative) return
  const json = JSON.stringify(snapshot)
  if (json === lastJson) return
  lastJson = json
  BloomWidget.update({ json }).catch(() => {
    lastJson = '' // plugin unavailable (older APK) — try again next time
  })
}

/** Tracker snapshot from the app's own cycle summary. */
export function trackerSnapshot(s: CycleSummary): WidgetSnapshot {
  if (!s.lastPeriodStart) return { role: 'none' }
  return {
    role: 'tracker',
    lastPeriodStart: s.lastPeriodStart,
    avgPeriodLength: s.avgPeriodLength,
    predictedNextStart: s.predictedNextStart ?? undefined,
    ovulationDate: s.ovulationDate ?? undefined,
    windowDays: s.predictionWindowDays,
    confidence: s.confidence,
  }
}
