import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase, todayIso } from '../lib/supabase'
import { computeCycleSummary } from '../lib/cycle'
import { rowFromSummary } from '../lib/statsRow'
import { DEFAULT_CATEGORIES } from '../lib/defaults'
import { addDaysIso } from '../lib/cycle'
import type {
  CycleStatsRow,
  LogEntry,
  LogValue,
  PartnerLink,
  PartnerNote,
  Reminder,
  Tracker,
  TrackerCategory,
} from '../lib/types'

// ------------------------------------------------------------ queries

export function useCategories(userId: string | undefined) {
  return useQuery({
    queryKey: ['categories', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tracker_categories')
        .select('*')
        .eq('user_id', userId!)
        .order('sort_order')
      if (error) throw error
      return data as TrackerCategory[]
    },
  })
}

export function useTrackers(userId: string | undefined) {
  return useQuery({
    queryKey: ['trackers', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trackers')
        .select('*')
        .eq('user_id', userId!)
        .order('sort_order')
      if (error) throw error
      return data as Tracker[]
    },
  })
}

export function useDayEntries(userId: string | undefined, date: string) {
  return useQuery({
    queryKey: ['entries', userId, date],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', userId!)
        .eq('date', date)
      if (error) throw error
      return data as LogEntry[]
    },
  })
}

export function useAllEntries(userId: string | undefined) {
  return useQuery({
    queryKey: ['entries-all', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('log_entries')
        .select('*')
        .eq('user_id', userId!)
        .order('date')
      if (error) throw error
      return data as LogEntry[]
    },
  })
}

export function useCycleStatsRow(userId: string | undefined) {
  return useQuery({
    queryKey: ['cycle-stats', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cycle_stats')
        .select('*')
        .eq('user_id', userId!)
        .maybeSingle()
      if (error) throw error
      return (data as CycleStatsRow) ?? null
    },
  })
}

/** The owner's link row (any non-revoked one). */
export function useOwnerLink(userId: string | undefined) {
  return useQuery({
    queryKey: ['owner-link', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_links')
        .select('*')
        .eq('owner_id', userId!)
        .neq('status', 'revoked')
        .maybeSingle()
      if (error) throw error
      return (data as PartnerLink) ?? null
    },
  })
}

/** The link row where the current user is the partner. */
export function usePartnerLink(userId: string | undefined) {
  return useQuery({
    queryKey: ['partner-link', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_links')
        .select('*')
        .eq('partner_id', userId!)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return (data as PartnerLink) ?? null
    },
  })
}

export function useReminders(userId: string | undefined) {
  return useQuery({
    queryKey: ['reminders', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', userId!)
        .order('time_of_day')
      if (error) throw error
      return data as Reminder[]
    },
  })
}

/** Display name of another (linked) profile — RLS only exposes linked profiles. */
export function useLinkedProfileName(profileId: string | null | undefined) {
  return useQuery({
    queryKey: ['profile-name', profileId],
    enabled: !!profileId,
    queryFn: async () => {
      const { data } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', profileId!)
        .maybeSingle()
      return (data?.display_name as string) ?? null
    },
  })
}

export function useUnreadNotes(userId: string | undefined) {
  return useQuery({
    queryKey: ['notes-unread', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partner_notes')
        .select('*')
        .eq('recipient_id', userId!)
        .is('read_at', null)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as PartnerNote[]
    },
  })
}

export function useSendNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      linkId,
      senderId,
      recipientId,
      body,
    }: {
      linkId: string
      senderId: string
      recipientId: string
      body: string
    }) => {
      const { error } = await supabase.from('partner_notes').insert({
        link_id: linkId,
        sender_id: senderId,
        recipient_id: recipientId,
        body: body.trim(),
      })
      if (error) throw error
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notes-unread'] }),
  })
}

export async function markNoteRead(noteId: string): Promise<void> {
  await supabase.from('partner_notes').update({ read_at: new Date().toISOString() }).eq('id', noteId)
}

// ------------------------------------------------------------ cycle stats recompute

/** Recompute the materialized cycle_stats row from the flow tracker's entries. */
export async function recomputeCycleStats(userId: string): Promise<void> {
  const { data: flowTracker } = await supabase
    .from('trackers')
    .select('id')
    .eq('user_id', userId)
    .eq('system_key', 'period_flow')
    .maybeSingle()
  if (!flowTracker) return
  const { data: entries } = await supabase
    .from('log_entries')
    .select('date')
    .eq('user_id', userId)
    .eq('tracker_id', flowTracker.id)
  const summary = computeCycleSummary((entries ?? []).map((e) => e.date as string), todayIso())
  await supabase.from('cycle_stats').upsert(rowFromSummary(userId, summary))
}

// ------------------------------------------------------------ mutations

export function useSaveEntry(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      trackerId,
      date,
      value,
      isFlow,
    }: {
      trackerId: string
      date: string
      value: LogValue | null
      isFlow: boolean
    }) => {
      if (!userId) throw new Error('not signed in')
      if (value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === false) {
        const { error } = await supabase
          .from('log_entries')
          .delete()
          .eq('user_id', userId)
          .eq('tracker_id', trackerId)
          .eq('date', date)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('log_entries')
          .upsert(
            { user_id: userId, tracker_id: trackerId, date, value },
            { onConflict: 'user_id,tracker_id,date' },
          )
        if (error) throw error
      }
      if (isFlow) await recomputeCycleStats(userId)
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['entries', userId, vars.date] })
      void qc.invalidateQueries({ queryKey: ['entries-all', userId] })
      if (vars.isFlow) void qc.invalidateQueries({ queryKey: ['cycle-stats', userId] })
    },
  })
}

/** Seed default categories/trackers and the last period, then mark the profile as tracker. */
export async function seedTrackerAccount(
  userId: string,
  lastPeriodStart: string | null,
  periodLength: number,
): Promise<void> {
  const { data: existing } = await supabase
    .from('trackers')
    .select('id')
    .eq('user_id', userId)
    .limit(1)
  if (!existing || existing.length === 0) {
    for (let ci = 0; ci < DEFAULT_CATEGORIES.length; ci++) {
      const cat = DEFAULT_CATEGORIES[ci]
      const { data: catRow, error: catErr } = await supabase
        .from('tracker_categories')
        .insert({ user_id: userId, name: cat.name, sort_order: ci })
        .select()
        .single()
      if (catErr) throw catErr
      const rows = cat.trackers.map((t, ti) => ({
        user_id: userId,
        category_id: catRow.id,
        name: t.name,
        icon: t.icon,
        color: t.color,
        input_type: t.input_type,
        config: t.config,
        sort_order: ti,
        shared_with_partner: t.shared_with_partner ?? false,
        system_key: t.system_key ?? null,
      }))
      const { error: trErr } = await supabase.from('trackers').insert(rows)
      if (trErr) throw trErr
    }
  }

  if (lastPeriodStart) {
    const { data: flowTracker } = await supabase
      .from('trackers')
      .select('id')
      .eq('user_id', userId)
      .eq('system_key', 'period_flow')
      .maybeSingle()
    if (flowTracker) {
      const rows = Array.from({ length: periodLength }, (_, i) => ({
        user_id: userId,
        tracker_id: flowTracker.id,
        date: addDaysIso(lastPeriodStart, i),
        value: 'medium' as const,
      }))
      const { error } = await supabase
        .from('log_entries')
        .upsert(rows, { onConflict: 'user_id,tracker_id,date' })
      if (error) throw error
    }
  }

  const { error: profErr } = await supabase.from('profiles').update({ role: 'tracker' }).eq('id', userId)
  if (profErr) throw profErr
  await recomputeCycleStats(userId)
}
