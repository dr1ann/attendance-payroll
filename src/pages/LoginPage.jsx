import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

export default function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const [form, setForm] = useState({ username: 'admin', password: 'admin123' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (isAuthenticated) {
    return <Navigate to="/" replace />
  }

  const onSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(form)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <div className="flex items-center gap-2">
            <Icon name="clock" className="w-12 h-12 text-blue-800" />
            <span className="text-3xl font-bold text-gray-900">
              Track<span className="text-yellow-500">r</span>
            </span>
          </div>
        </div>

        {/* Header */}
        <p className="text-center text-gray-500 mb-8">STI College Ormoc: Attendance & Payroll Management</p>

        <form className="grid gap-5" onSubmit={onSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="users" className="w-4 h-4" />
              </span>
              <input
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                placeholder="Enter your username"
                value={form.username}
                onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                <Icon name="lock" className="w-4 h-4" />
              </span>
              <input
                className="w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
                type="password"
                placeholder="Enter your password"
                value={form.password}
                onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              />
            </div>
          </div>

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}

          <Button type="submit" disabled={loading} className="w-full py-3 mt-2">
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <p className="text-center mt-6">
          <a href="#" className="text-blue-800 hover:underline text-sm font-medium">Forgot password?</a>
        </p>

        <p className="text-center text-gray-400 text-xs mt-8">
          Secure login for authorized personnel only
        </p>
      </div>
    </main>
  )
}
