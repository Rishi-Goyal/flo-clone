// Default categories and trackers seeded at onboarding. Everything here is
// editable afterwards in Settings → Trackers (the customisability core).
import type { InputType, TrackerConfig } from './types'

export interface DefaultTracker {
  name: string
  icon: string
  color: string
  input_type: InputType
  config: TrackerConfig
  system_key?: string
  shared_with_partner?: boolean
}

export interface DefaultCategory {
  name: string
  trackers: DefaultTracker[]
}

export const DEFAULT_CATEGORIES: DefaultCategory[] = [
  {
    name: 'Body',
    trackers: [
      {
        name: 'Period flow',
        icon: 'Droplets',
        color: '#E4557F',
        input_type: 'choice',
        config: {
          options: [
            { value: 'spotting', label: 'Spotting' },
            { value: 'light', label: 'Light' },
            { value: 'medium', label: 'Medium' },
            { value: 'heavy', label: 'Heavy' },
          ],
        },
        system_key: 'period_flow',
        shared_with_partner: true,
      },
      { name: 'Cramps', icon: 'Zap', color: '#E8743D', input_type: 'boolean', config: {} },
      { name: 'Headache', icon: 'Brain', color: '#9B7EC4', input_type: 'boolean', config: {} },
      { name: 'Bloating', icon: 'CircleDashed', color: '#6FB5A2', input_type: 'boolean', config: {} },
    ],
  },
  {
    name: 'Mood & energy',
    trackers: [
      {
        name: 'Mood',
        icon: 'Smile',
        color: '#E8A33D',
        input_type: 'multichoice',
        config: {
          options: [
            { value: 'happy', label: 'Happy' },
            { value: 'calm', label: 'Calm' },
            { value: 'sad', label: 'Sad' },
            { value: 'irritable', label: 'Irritable' },
            { value: 'anxious', label: 'Anxious' },
            { value: 'energetic', label: 'Energetic' },
          ],
        },
      },
      {
        name: 'Energy',
        icon: 'BatteryMedium',
        color: '#6FB5A2',
        input_type: 'scale',
        config: { min: 1, max: 5, min_label: 'Drained', max_label: 'Full' },
      },
    ],
  },
  {
    name: 'Lifestyle',
    trackers: [
      { name: 'Sleep', icon: 'Moon', color: '#9B7EC4', input_type: 'number', config: { unit: 'h' } },
      { name: 'Notes', icon: 'NotebookPen', color: '#8A6B7D', input_type: 'text', config: {} },
    ],
  },
]

export const TRACKER_COLORS = [
  '#E4557F', '#E8743D', '#E8A33D', '#6FB5A2', '#4A9ECF', '#9B7EC4', '#C45D9E', '#8A6B7D',
]

export const TRACKER_ICONS = [
  'Droplets', 'Zap', 'Brain', 'CircleDashed', 'Smile', 'Frown', 'BatteryMedium', 'Moon',
  'NotebookPen', 'Heart', 'HeartPulse', 'Pill', 'Coffee', 'Dumbbell', 'Utensils', 'Thermometer',
  'Wind', 'CloudRain', 'Sparkles', 'Flame', 'Salad', 'GlassWater', 'Bed', 'Activity',
]
