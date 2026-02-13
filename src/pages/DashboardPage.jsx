import { Link } from 'react-router-dom'

const cards = [
  { title: 'Teachers', description: 'Manage teacher profiles and hourly rates.', to: '/teachers', metric: 'Master Data' },
  { title: 'Schedules', description: 'Define class schedules and grace windows.', to: '/schedules', metric: 'Time Rules' },
  { title: 'Calendar', description: 'Configure school days, holidays, and notes.', to: '/calendar', metric: 'Academic Dates' },
  { title: 'Settings', description: 'Maintain attendance defaults and timezone.', to: '/settings', metric: 'System Config' },
]

export default function DashboardPage() {
  return (
    <>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Dashboard</h2>
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {cards.map((card) => (
          <article key={card.title} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow">
            <p className="text-xs font-semibold text-blue-800 uppercase tracking-wide mb-1">{card.metric}</p>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">{card.title}</h3>
            <p className="text-sm text-gray-600 mb-3">{card.description}</p>
            <Link to={card.to} className="text-sm font-medium text-blue-800 hover:underline">
              Manage {card.title}
            </Link>
          </article>
        ))}
      </section>
    </>
  )
}
