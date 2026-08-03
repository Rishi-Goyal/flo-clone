// Edge Function: sends an FCM push to the recipient when a partner note is
// inserted. Invoked by a Database Webhook on partner_notes INSERT.
//
// Required secrets (Edge Functions → notify-note → Secrets):
//   FCM_SERVICE_ACCOUNT  — full JSON of a Firebase service-account key
//   NOTE_WEBHOOK_SECRET  — random string; the webhook sends it as x-note-secret
// (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.)
//
// Deploy with "Verify JWT" DISABLED — authentication is the shared secret.

import { createClient } from 'npm:@supabase/supabase-js@2'

interface NoteRecord {
  id: string
  sender_id: string
  recipient_id: string
  body: string
}

const svcAccount = JSON.parse(Deno.env.get('FCM_SERVICE_ACCOUNT') ?? '{}')
const webhookSecret = Deno.env.get('NOTE_WEBHOOK_SECRET') ?? ''

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function b64url(data: string | Uint8Array): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Mint a Google OAuth2 access token from the service account (RS256 JWT). */
async function googleAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64url(
    JSON.stringify({
      iss: svcAccount.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const pem = (svcAccount.private_key as string)
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '')
  const keyData = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claims}`)),
  )
  const jwt = `${header}.${claims}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  })
  if (!res.ok) throw new Error(`oauth failed: ${res.status} ${await res.text()}`)
  return (await res.json()).access_token
}

Deno.serve(async (req) => {
  if (req.headers.get('x-note-secret') !== webhookSecret || !webhookSecret) {
    return new Response('forbidden', { status: 403 })
  }

  const payload = await req.json()
  if (payload.type !== 'INSERT' || payload.table !== 'partner_notes') {
    return new Response('ignored', { status: 200 })
  }
  const note = payload.record as NoteRecord

  const [{ data: sender }, { data: tokens }] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', note.sender_id).maybeSingle(),
    supabase.from('push_tokens').select('token').eq('user_id', note.recipient_id),
  ])
  if (!tokens?.length) return new Response('no tokens', { status: 200 })

  const accessToken = await googleAccessToken()
  const results: string[] = []

  for (const { token } of tokens) {
    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${svcAccount.project_id}/messages:send`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          message: {
            token,
            notification: {
              title: `💌 Note from ${sender?.display_name ?? 'your partner'}`,
              body: note.body.length > 120 ? note.body.slice(0, 117) + '…' : note.body,
            },
            android: { priority: 'HIGH', notification: { channel_id: 'notes' } },
            data: { kind: 'partner_note', note_id: note.id },
          },
        }),
      },
    )
    if (res.status === 404 || res.status === 410) {
      // token no longer valid — clean it up
      await supabase.from('push_tokens').delete().eq('token', token)
      results.push(`${token.slice(0, 12)}: stale, removed`)
    } else {
      results.push(`${token.slice(0, 12)}: ${res.status}`)
    }
  }

  return new Response(JSON.stringify({ sent: results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
