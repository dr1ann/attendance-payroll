import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

const cards = [
  { title: 'Scan QR', description: 'Scan teacher attendance via QR code.', to: '/scan', metric: 'Attendance' },
  { title: 'Attendance', description: 'View and filter attendance history.', to: '/attendance', metric: 'History' },
  { title: 'Teachers', description: 'Manage teacher profiles and hourly rates.', to: '/teachers', metric: 'Master Data' },
  { title: 'Schedules', description: 'Define class schedules and grace windows.', to: '/schedules', metric: 'Time Rules' },
  { title: 'Settings', description: 'Maintain attendance defaults and timezone.', to: '/settings', metric: 'System Config' },
]

const payrollCards = [
  { title: 'Attendance', description: 'View and filter attendance history.', to: '/attendance', metric: 'History' },
  { title: 'Teachers', description: 'View teacher profiles and rates.', to: '/teachers', metric: 'Master Data' },
  { title: 'Schedules', description: 'View class schedules and grace windows.', to: '/schedules', metric: 'Time Rules' },
]

function getCards(role) {
  if (role === 'payroll_viewer') return payrollCards
  return cards
}

export default function DashboardPage() {
  const { user } = useAuth()

  // Teachers should go to their own dashboard
  if (user?.role === 'teacher') {
    return <Navigate to="/my-attendance" replace />
  }

  const dashboardCards = getCards(user?.role)

  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Admin Dashboard</h2>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dashboardCards.map((card) => (
          <article key={card.title} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">{card.metric}</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
            <p className="text-sm text-gray-600 mb-3">{card.description}</p>
            <Link to={card.to} className="text-sm font-medium text-blue-800 hover:underline">
              {user?.role === 'admin' ? 'Manage' : 'View'} {card.title}
            </Link>
          </article>
        ))}
      </section>
    </>
  )
}
