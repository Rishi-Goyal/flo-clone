import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { isNative, supabase } from '../lib/supabase'

/**
 * Registers this device for FCM push (Android app only) and keeps the token
 * in push_tokens. Silently no-ops on web, when permission is denied, or when
 * Firebase isn't configured yet (google-services.json absent from the build).
 */
export function usePushRegistration(userId: string | undefined) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!isNative || !userId) return
    const cleanups: Array<() => void> = []

    void (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications')

        const perm = await PushNotifications.requestPermissions()
        if (perm.receive !== 'granted') return

        // channel the notify-note function targets (Android 8+)
        await PushNotifications.createChannel({
          id: 'notes',
          name: 'Partner notes',
          description: 'A note from your partner',
          importance: 4,
        })

        const reg = await PushNotifications.addListener('registration', ({ value }) => {
          void supabase
            .from('push_tokens')
            .upsert({ token: value, user_id: userId, platform: 'android', updated_at: new Date().toISOString() })
        })
        cleanups.push(() => void reg.remove())

        // foreground pushes: refresh the note banner immediately
        const rec = await PushNotifications.addListener('pushNotificationReceived', () => {
          void qc.invalidateQueries({ queryKey: ['notes-unread'] })
        })
        cleanups.push(() => void rec.remove())

        await PushNotifications.register()
      } catch {
        // plugin unavailable or Firebase not configured — app works without push
      }
    })()

    return () => cleanups.forEach((fn) => fn())
  }, [userId, qc])
}
