export type Phase = 'menstrual' | 'follicular' | 'ovulation' | 'luteal'
export type Confidence = 'high' | 'medium' | 'low'
export type InputType = 'boolean' | 'scale' | 'choice' | 'multichoice' | 'number' | 'text'
export type Role = 'tracker' | 'partner'

export type LogValue = boolean | number | string | string[]

export interface Profile {
  id: string
  display_name: string | null
  role: Role | null
  timezone: string
  created_at: string
}

export interface PartnerLink {
  id: string
  owner_id: string
  partner_id: string | null
  invite_code: string
  status: 'pending' | 'active' | 'revoked'
  share_phase: boolean
  share_predictions: boolean
  share_period_dates: boolean
  share_logs: boolean
  share_notes: boolean
  created_at: string
  accepted_at: string | null
}

export interface TrackerCategory {
  id: string
  user_id: string
  name: string
  sort_order: number
}

export interface ChoiceOption {
  value: string
  label: string
}

export interface TrackerConfig {
  min?: number
  max?: number
  min_label?: string
  max_label?: string
  options?: ChoiceOption[]
  unit?: string
}

export interface Tracker {
  id: string
  user_id: string
  category_id: string | null
  name: string
  icon: string
  color: string
  input_type: InputType
  config: TrackerConfig
  sort_order: number
  is_active: boolean
  shared_with_partner: boolean
  system_key: string | null
}

export interface LogEntry {
  id: string
  user_id: string
  tracker_id: string
  date: string
  value: LogValue
}

export interface CycleStatsRow {
  user_id: string
  last_period_start: string | null
  avg_cycle_length: number | null
  cycle_length_stddev: number | null
  avg_period_length: number | null
  predicted_next_start: string | null
  prediction_window_days: number | null
  fertile_window_start: string | null
  fertile_window_end: string | null
  ovulation_date: string | null
  current_phase: Phase | null
  cycle_day: number | null
  confidence: Confidence | null
  updated_at: string
}

export interface Reminder {
  id: string
  user_id: string
  title: string
  kind: 'medication' | 'birth_control' | 'custom'
  time_of_day: string
  days_of_week: number[]
  active: boolean
}
