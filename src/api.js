const API_BASE = '/api'

export async function apiRequest(path, options = {}, token = null) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  })

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    throw new Error(payload.message || 'Request failed')
  }

  return payload
}

export async function getSalaryComputationSummary(date_from, date_to, token = null) {
  return apiRequest(`/salary-computation/summary?date_from=${date_from}&date_to=${date_to}`, {}, token)
}

export async function getAttendanceSalaryBreakdown(teacherId, date_from, date_to, token = null) {
  return apiRequest(`/salary-computation/teacher/${teacherId}/breakdown?date_from=${date_from}&date_to=${date_to}`, {}, token)
}
