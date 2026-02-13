import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import AppLogo from '../components/ui/AppLogo'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

const navItems = [
  { label: 'Dashboard', to: '/', icon: 'dashboard' },
  { label: 'Teachers', to: '/teachers', icon: 'users' },
  { label: 'Schedules', to: '/schedules', icon: 'clock' },
  { label: 'Calendar', to: '/calendar', icon: 'calendar' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
]

export default function AppLayout() {
  const { user, logout } = useAuth()

  return (
    <main className="grid grid-cols-[256px_1fr] min-h-screen">
      <aside className="bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-4">
        
        <AppLogo />
        <nav className="flex flex-col gap-1" aria-label="Main navigation">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-800 to-blue-900 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <Button variant="ghost" className="w-full justify-start" icon={<Icon name="moon" />}>
            Dark Mode
          </Button>
          <p className="text-xs text-gray-500 px-2">{user?.username} • {user?.role}</p>
          <Button variant="text-danger" onClick={logout} className="w-full justify-start" icon={<Icon name="logout" />}>
            Logout
          </Button>
        </div>
      </aside>

      <section className="p-6 bg-white overflow-auto">
        <Outlet />
      </section>
    </main>
  )
}
