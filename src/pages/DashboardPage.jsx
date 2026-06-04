import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { apiRequest } from '../api'
import Icon from '../components/ui/Icon'
import './DashboardPage.css'

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(value) {
  return Number(value).toLocaleString('en-PH', { style: 'currency', currency: 'PHP' })
}

function formatTime(scanTime) {
  const d = new Date(scanTime)
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color, icon }) {
  return (
    <div style={{ background: color }} className="rounded-2xl p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest opacity-80 text-white">{label}</span>
        <span className="opacity-60 text-white">{icon}</span>
      </div>
      <p className="text-4xl font-bold text-white leading-none">{value ?? '—'}</p>
      {sub && <p className="text-xs text-white opacity-70">{sub}</p>}
    </div>
  )
}

function AttendanceBadge({ scanType, status }) {
  if (scanType === 'time_in') {
    return status === 'late'
      ? <span className="dashboard-badge dashboard-badge-late">Late In</span>
      : <span className="dashboard-badge dashboard-badge-on-time">On Time</span>
  }
  return <span className="dashboard-badge dashboard-badge-out">Time Out</span>
}

function ActivityRow({ item }) {
  return (
    <div className="dashboard-activity-row">
      <div className="dashboard-activity-avatar">
        {item.teacher_name.split(' ').map(n => n[0]).slice(0, 2).join('')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{item.teacher_name}</p>
        <p className="text-xs text-gray-500 truncate">{item.department}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <AttendanceBadge scanType={item.scan_type} status={item.status} />
        <span className="text-xs text-gray-400">{formatTime(item.scan_time)}</span>
      </div>
    </div>
  )
}

function QuickAction({ to, icon, label, description, accent }) {
  return (
    <Link to={to} className="dashboard-quick-action group" style={{ '--accent': accent }}>
      <div className="dashboard-quick-action-icon">{icon}</div>
      <div>
        <p className="text-sm font-semibold text-gray-900 group-hover:text-[var(--accent)] transition-colors">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <svg className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[var(--accent)] w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 18l6-6-6-6"/></svg>
    </Link>
  )
}

function SplitStat({ label, a, b, aLabel, bLabel }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">{label}</p>
      <div className="flex items-end gap-4">
        <div>
          <p className="text-2xl font-bold text-gray-900">{a}</p>
          <p className="text-xs text-gray-500">{aLabel}</p>
        </div>
        <div className="h-8 w-px bg-gray-200" />
        <div>
          <p className="text-2xl font-bold text-gray-900">{b}</p>
          <p className="text-xs text-gray-500">{bLabel}</p>
        </div>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, token } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  if (user?.role === 'teacher') {
    return <Navigate to="/my-attendance" replace />
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await apiRequest('/dashboard/summary', {}, token)
        if (!cancelled) setData(result)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [token])

  const isAdmin = user?.role === 'admin'

  return (
    <div className="dashboard-root">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Admin Dashboard</h1>
          {data && (
            <p className="dashboard-subtitle">{formatDate(data.today.date)}</p>
          )}
        </div>
      </div>

      {loading && (
        <div className="dashboard-loading">
          <div className="dashboard-spinner" />
          <p>Loading dashboard data…</p>
        </div>
      )}

      {error && (
        <div className="dashboard-error">
          <Icon name="alert" />
          <span>Failed to load dashboard: {error}</span>
        </div>
      )}

      {data && (
        <>
          {/* KPI Row */}
          <section className="dashboard-kpi-grid" aria-label="Key metrics">
            <StatCard
              label="Active Teachers"
              value={data.teachers.active}
              sub={`${data.teachers.inactive} inactive · ${data.teachers.total} total`}
              color="linear-gradient(135deg, #1e40af 0%, #1d4ed8 100%)"
              icon={<Icon name="users" className="w-5 h-5" />}
            />
            <StatCard
              label="Present Today"
              value={data.today.present}
              sub={`${data.today.scheduled} scheduled · ${data.today.absent} absent`}
              color="linear-gradient(135deg, #065f46 0%, #059669 100%)"
              icon={<Icon name="check" className="w-5 h-5" />}
            />
            <StatCard
              label="Late Today"
              value={data.today.late}
              sub="teachers arrived late"
              color="linear-gradient(135deg, #92400e 0%, #d97706 100%)"
              icon={<Icon name="clock" className="w-5 h-5" />}
            />
            <StatCard
              label="Departments"
              value={data.departments}
              sub="active departments"
              color="linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)"
              icon={<Icon name="dashboard" className="w-5 h-5" />}
            />
          </section>

          <div className="dashboard-body">
            {/* Left column */}
            <div className="dashboard-left">

              {/* Today's Attendance Feed */}
              <section className="dashboard-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">Today's Activity</h2>
                  <Link to="/attendance" className="dashboard-card-link">View all →</Link>
                </div>
                {data.recent_activity.length === 0 ? (
                  <div className="dashboard-empty">
                    <Icon name="clock" className="w-8 h-8 text-gray-300" />
                    <p>No attendance scans yet today</p>
                  </div>
                ) : (
                  <div className="dashboard-activity-list">
                    {data.recent_activity.map((item, i) => (
                      <ActivityRow key={i} item={item} />
                    ))}
                  </div>
                )}
              </section>

              {/* This Month Payroll Snapshot */}
              <section className="dashboard-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">This Month's Payroll Snapshot</h2>
                  <Link to="/salary-computation" className="dashboard-card-link">Compute →</Link>
                </div>
                <div className="dashboard-payroll-grid">
                  <div className="dashboard-payroll-item dashboard-payroll-gross">
                    <p className="text-xs font-semibold uppercase tracking-widest text-blue-700 mb-1">Gross Total</p>
                    <p className="text-3xl font-bold text-blue-900">{formatCurrency(data.this_month.total_gross)}</p>
                  </div>
                  <div className="dashboard-payroll-item dashboard-payroll-deductions">
                    <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-1">Deductions</p>
                    <p className="text-3xl font-bold text-amber-900">−{formatCurrency(data.this_month.total_deductions)}</p>
                  </div>
                  <div className="dashboard-payroll-item dashboard-payroll-net">
                    <p className="text-xs font-semibold uppercase tracking-widest text-green-700 mb-1">Net Payroll</p>
                    <p className="text-3xl font-bold text-green-900">{formatCurrency(data.this_month.total_net)}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  Period: {data.this_month.period_from} — {data.this_month.period_to} · Active teachers only
                </p>
              </section>
            </div>

            {/* Right column */}
            <div className="dashboard-right">

              {/* Teacher Breakdown */}
              <section className="dashboard-card">
                <div className="dashboard-card-header">
                  <h2 className="dashboard-card-title">Teacher Breakdown</h2>
                  <Link to="/teachers" className="dashboard-card-link">Manage →</Link>
                </div>
                <div className="flex flex-col gap-5 pt-1">
                  <SplitStat
                    label="By Type"
                    a={data.teachers.full_time}
                    aLabel="Full-time"
                    b={data.teachers.part_time}
                    bLabel="Part-time"
                  />
                  <div className="h-px bg-gray-100" />
                  <SplitStat
                    label="By Status"
                    a={data.teachers.active}
                    aLabel="Active"
                    b={data.teachers.inactive}
                    bLabel="Inactive"
                  />
                  {/* Visual bar */}
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Attendance rate today</p>
                    <div className="dashboard-progress-track">
                      <div
                        className="dashboard-progress-fill"
                        style={{
                          width: data.today.scheduled > 0
                            ? `${Math.round((data.today.present / data.today.scheduled) * 100)}%`
                            : '0%'
                        }}
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {data.today.scheduled > 0
                        ? `${Math.round((data.today.present / data.today.scheduled) * 100)}%`
                        : '—'} ({data.today.present}/{data.today.scheduled} scheduled teachers)
                    </p>
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              {isAdmin && (
                <section className="dashboard-card">
                  <div className="dashboard-card-header">
                    <h2 className="dashboard-card-title">Quick Actions</h2>
                  </div>
                  <div className="flex flex-col gap-1">
                    <QuickAction
                      to="/teachers"
                      icon={<Icon name="users" className="w-4 h-4" />}
                      label="Manage Teachers"
                      description="Add or edit teacher profiles"
                      accent="#7c3aed"
                    />
                    <QuickAction
                      to="/schedules"
                      icon={<Icon name="clock" className="w-4 h-4" />}
                      label="Schedules"
                      description="Set class time and grace windows"
                      accent="#0891b2"
                    />
                    <QuickAction
                      to="/reports"
                      icon={<Icon name="save" className="w-4 h-4" />}
                      label="Export Reports"
                      description="Download attendance & payroll reports"
                      accent="#059669"
                    />
                    <QuickAction
                      to="/departments"
                      icon={<Icon name="dashboard" className="w-4 h-4" />}
                      label="Departments"
                      description="Manage active departments"
                      accent="#d97706"
                    />
                    <QuickAction
                      to="/settings"
                      icon={<Icon name="settings" className="w-4 h-4" />}
                      label="Settings"
                      description="Configure deductions & timezone"
                      accent="#6b7280"
                    />
                  </div>
                </section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
