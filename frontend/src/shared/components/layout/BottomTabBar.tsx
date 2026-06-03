import { NavLink } from 'react-router-dom';

const TABS = [
  { to: '/map',  label: '지도', icon: '🗺️' },
  { to: '/list', label: '목록', icon: '📋' },
  { to: '/new',  label: '신규', icon: '✨' },
  { to: '/my',   label: 'MY',  icon: '👤' },
] as const;

export function BottomTabBar() {
  return (
    <nav className="flex border-t border-gray-200 bg-white shrink-0">
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
              isActive ? 'text-primary font-semibold' : 'text-gray-400'
            }`
          }
        >
          <span className="text-xl leading-none">{icon}</span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
