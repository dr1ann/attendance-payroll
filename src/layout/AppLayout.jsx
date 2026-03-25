import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../api'
import AppLogo from '../components/ui/AppLogo'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'
import Modal from '../components/ui/Modal'

const adminNav = [
  { label: 'Dashboard', to: '/', icon: 'dashboard' },
  { label: 'Scan QR', to: '/scan', icon: 'qr-scan' },
  { label: 'Attendance', to: '/attendance', icon: 'history' },
  { label: 'Teachers', to: '/teachers', icon: 'users' },
  { label: 'Schedules', to: '/schedules', icon: 'clock' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
]

const payrollViewerNav = [
  { label: 'Dashboard', to: '/', icon: 'dashboard' },
  { label: 'Attendance', to: '/attendance', icon: 'history' },
  { label: 'Teachers', to: '/teachers', icon: 'users' },
  { label: 'Schedules', to: '/schedules', icon: 'clock' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
]

const teacherNav = [
  { label: 'My Dashboard', to: '/my-attendance', icon: 'dashboard' },
]

function getNavItems(role) {
  if (role === 'teacher') return teacherNav
  if (role === 'payroll_viewer') return payrollViewerNav
  return adminNav
}

export default function AppLayout() {
  const { user, token, logout } = useAuth()
  const navItems = getNavItems(user?.role)

  const [changePwOpen, setChangePwOpen] = useState(false)
  const [pwForm, setPwForm] = useState({ current_password: '', new_password: '' })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')
  const [pwLoading, setPwLoading] = useState(false)

  const changePassword = async () => {
    setPwError('')
    setPwSuccess('')
    setPwLoading(true)
    try {
      await apiRequest(
        '/auth/change-password',
        {
          method: 'PUT',
          body: JSON.stringify(pwForm),
        },
        token,
      )
      setPwSuccess('Password changed successfully')
      setPwForm({ current_password: '', new_password: '' })
    } catch (err) {
      setPwError(err.message)
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <main className="grid grid-cols-[256px_1fr] h-screen">
      <aside className="bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-4 sticky top-0 h-screen overflow-hidden">
        
        <AppLogo />
        <nav className="flex flex-col gap-2" aria-label="Main navigation">
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
          <Button
            variant="ghost"
            className="w-full justify-start"
            icon={<Icon name="lock" />}
            onClick={() => {
              setChangePwOpen(true)
              setPwError('')
              setPwSuccess('')
              setPwForm({ current_password: '', new_password: '' })
              setShowCurrentPw(false)
              setShowNewPw(false)
            }}
          >
            Change Password
          </Button>
          <Button variant="text-danger" onClick={logout} className="w-full justify-start" icon={<Icon name="logout" />}>
            Logout
          </Button>
        </div>
      </aside>

      <section className="p-6 bg-white overflow-y-auto h-screen">
        <Outlet />
      </section>

      <Modal
        open={changePwOpen}
        title="Change Password"
        onClose={() => setChangePwOpen(false)}
        onConfirm={changePassword}
        confirmLabel="Change Password"
        confirmVariant="primary"
        busy={pwLoading}
      >
        <div className="grid gap-4">
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Current Password
            <div className="relative">
              <input
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                type={showCurrentPw ? 'text' : 'password'}
                value={pwForm.current_password}
                onChange={(e) => setPwForm((prev) => ({ ...prev, current_password: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={() => setShowCurrentPw((prev) => !prev)}
                tabIndex={-1}
              >
                <Icon name={showCurrentPw ? 'eye-off' : 'eye'} className="w-4 h-4" />
              </button>
            </div>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            New Password
            <div className="relative">
              <input
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                type={showNewPw ? 'text' : 'password'}
                value={pwForm.new_password}
                onChange={(e) => setPwForm((prev) => ({ ...prev, new_password: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={() => setShowNewPw((prev) => !prev)}
                tabIndex={-1}
              >
                <Icon name={showNewPw ? 'eye-off' : 'eye'} className="w-4 h-4" />
              </button>
            </div>
          </label>
          {pwError ? <p className="text-red-600 text-sm">{pwError}</p> : null}
          {pwSuccess ? <p className="text-green-600 text-sm">{pwSuccess}</p> : null}
        </div>
      </Modal>
    </main>
  )
}
