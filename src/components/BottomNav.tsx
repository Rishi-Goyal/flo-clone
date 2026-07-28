import { NavLink } from 'react-router-dom'
import { MSymbol } from './TrackerIcon'

const tabs = [
  { to: '/today', label: 'Today', icon: 'wb_sunny' },
  { to: '/calendar', label: 'Calendar', icon: 'calendar_month' },
  { to: '/insights', label: 'Insights', icon: 'insights' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function Item({ to, label, icon }: (typeof tabs)[number]) {
  return (
    <NavLink key={to} to={to} className="flex flex-1 flex-col items-center gap-1 md:w-full md:flex-none md:py-2">
      {({ isActive }) => (
        <>
          <span
            className={`flex h-8 w-16 items-center justify-center rounded-full transition-colors ${
              isActive ? 'bg-blush-deep' : ''
            }`}
          >
            <MSymbol name={icon} size={24} fill={isActive} color={isActive ? '#8F2B4C' : '#5F4353'} />
          </span>
          <span className={`text-xs ${isActive ? 'font-semibold text-plum' : 'font-medium text-ink-soft'}`}>
            {label}
          </span>
        </>
      )}
    </NavLink>
  )
}

/** M3 navigation bar on mobile, navigation rail on md+ screens. */
export function BottomNav() {
  return (
    <>
      {/* mobile bar */}
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-nav-line bg-nav pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto flex max-w-md pt-3 pb-2">{tabs.map((t) => Item(t))}</div>
      </nav>

      {/* desktop rail */}
      <nav className="fixed inset-y-0 left-0 z-20 hidden w-[88px] flex-col items-center gap-2 border-r border-nav-line bg-nav py-6 md:flex">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-[14px] bg-rose">
          <MSymbol name="water_drop" size={24} fill color="#fff" />
        </span>
        {tabs.map((t) => Item(t))}
      </nav>
    </>
  )
}
