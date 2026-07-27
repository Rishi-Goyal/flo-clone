import type { Phase } from '../lib/types'

export const PHASE_UI: Record<Phase, { label: string; color: string; soft: string; text: string }> = {
  menstrual: { label: 'Period', color: '#E4557F', soft: '#FBE9EE', text: '#C43D68' },
  follicular: { label: 'Follicular', color: '#E8A33D', soft: '#FBEED8', text: '#B87A1E' },
  ovulation: { label: 'Ovulation', color: '#6FB5A2', soft: '#DDF0EA', text: '#3E8871' },
  luteal: { label: 'Luteal', color: '#9B7EC4', soft: '#EFE8F8', text: '#6E51A0' },
}
