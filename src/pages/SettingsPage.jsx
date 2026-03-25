import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Icon from '../components/ui/Icon'

const defaults = {
  late_grace_minutes: 15,
  duplicate_scan_window_minutes: 5,
  timezone: 'Asia/Manila',
}

export default function SettingsPage() {
  const { token, isAdmin } = useAuth()
  const [settings, setSettings] = useState(defaults)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSettings = useCallback(async () => {
    const data = await apiRequest('/settings/attendance', {}, token)
    setSettings(data)
  }, [token])

  useEffect(() => {
    loadSettings().catch((err) => setError(err.message))
  }, [loadSettings])

  const onSave = async (event) => {
    event.preventDefault()
    if (!isAdmin) return

    setError('')
    setLoading(true)
    try {
      await apiRequest(
        '/settings/attendance',
        {
          method: 'PUT',
          body: JSON.stringify({
            ...settings,
            late_grace_minutes: Number(settings.late_grace_minutes),
            duplicate_scan_window_minutes: Number(settings.duplicate_scan_window_minutes),
          }),
        },
        token,
      )
      await loadSettings()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <section>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Attendance Settings</h2>
      </div>
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <form className="grid gap-4" onSubmit={onSave}>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Late Grace Minutes
              <input
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                type="number"
                min="0"
                value={settings.late_grace_minutes}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, late_grace_minutes: event.target.value }))
                }
                disabled={!isAdmin}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Duplicate Scan Window Minutes
              <input
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                type="number"
                min="0"
                value={settings.duplicate_scan_window_minutes}
                onChange={(event) =>
                  setSettings((prev) => ({ ...prev, duplicate_scan_window_minutes: event.target.value }))
                }
                disabled={!isAdmin}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Timezone
              <input
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                value={settings.timezone}
                onChange={(event) => setSettings((prev) => ({ ...prev, timezone: event.target.value }))}
                disabled={!isAdmin}
              />
            </label>
            {isAdmin ? (
              <Button type="submit" disabled={loading} icon={<Icon name="save" />} className="w-full mt-2">
                {loading ? 'Saving...' : 'Save Settings'}
              </Button>
            ) : null}
          </form>
          {error ? <p className="text-red-600 text-sm mt-4">{error}</p> : null}
        </div>
      </div>
    </section>
  )
}
