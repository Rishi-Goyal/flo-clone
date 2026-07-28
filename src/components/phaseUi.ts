import type { Phase } from '../lib/types'

export interface PhasePalette {
  label: string
  /** main accent (ring progress, chips) */
  color: string
  /** soft chip / tag background */
  soft: string
  /** hero card background */
  hero: string
  /** ring track on the hero */
  track: string
  /** readable text on soft/hero surfaces */
  text: string
}

export const PHASE_UI: Record<Phase, PhasePalette> = {
  menstrual: {
    label: 'Period',
    color: '#E4557F',
    soft: '#FBE9EE',
    hero: '#FBE9EE',
    track: '#F6D3DD',
    text: '#8F2B4C',
  },
  follicular: {
    label: 'Follicular',
    color: '#E8A33D',
    soft: '#FBEED8',
    hero: '#FBF1E2',
    track: '#F3DDB4',
    text: '#8A5C12',
  },
  ovulation: {
    label: 'Ovulation',
    color: '#6FB5A2',
    soft: '#DDF0EA',
    hero: '#E6F4EF',
    track: '#C4E4D9',
    text: '#2F6D59',
  },
  luteal: {
    label: 'Luteal',
    color: '#9B7EC4',
    soft: '#EFE8F8',
    hero: '#F3EEFB',
    track: '#E3D7F5',
    text: '#6E51A0',
  },
}
