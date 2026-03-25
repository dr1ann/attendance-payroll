import { useCallback, useEffect, useMemo, useState } from 'react'
import QRCode from 'qrcode'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import ActionButtons from '../components/ui/ActionButtons'
import Icon from '../components/ui/Icon'

const emptyTeacher = {
  employee_no: '',
  first_name: '',
  last_name: '',
  department: '',
  hourly_rate: 0,
  status: 'active',
}

export default function TeachersPage() {
  const { token, isAdmin } = useAuth()
  const [teachers, setTeachers] = useState([])
  const [teacherForm, setTeacherForm] = useState(emptyTeacher)
  const [editTeacherId, setEditTeacherId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [accountTarget, setAccountTarget] = useState(null)
  const [accountForm, setAccountForm] = useState({ username: '', password: '' })
  const [showAccountPassword, setShowAccountPassword] = useState(false)
  const [resetTarget, setResetTarget] = useState(null)
  const [resetPassword, setResetPassword] = useState('')
  const [showResetPassword, setShowResetPassword] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrTarget, setQrTarget] = useState(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [qrGenerating, setQrGenerating] = useState(false)
  const [qrError, setQrError] = useState('')
  const [teacherFormErrors, setTeacherFormErrors] = useState({})
  const [accountFormErrors, setAccountFormErrors] = useState({})
  const [resetFormErrors, setResetFormErrors] = useState({})
  const [teacherModalError, setTeacherModalError] = useState('')
  const [accountModalError, setAccountModalError] = useState('')
  const [resetModalError, setResetModalError] = useState('')

  const loadTeachers = useCallback(async () => {
    const rows = await apiRequest('/teachers', {}, token)
    setTeachers(rows)
  }, [token])

  useEffect(() => {
    loadTeachers().catch((err) => setError(err.message))
  }, [loadTeachers])

  useEffect(() => {
    if (!qrTarget) {
      setQrDataUrl('')
      setQrError('')
      return
    }

    let cancelled = false
    setQrGenerating(true)
    setQrDataUrl('')
    setQrError('')

    QRCode.toDataURL(qrTarget.employee_no, { margin: 1, scale: 8 })
      .then((url) => {
        if (!cancelled) {
          setQrDataUrl(url)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setQrError(err?.message || 'Unable to generate QR code')
        }
      })
      .finally(() => {
        if (!cancelled) {
          setQrGenerating(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [qrTarget])

  const saveTeacher = async () => {
    if (!isAdmin) {
      return
    }

    setError('')
    setTeacherFormErrors({})
    setTeacherModalError('')

    const errs = {}
    if (!teacherForm.employee_no.trim()) errs.employee_no = 'Employee number is required'
    if (!teacherForm.first_name.trim()) errs.first_name = 'First name is required'
    if (!teacherForm.last_name.trim()) errs.last_name = 'Last name is required'
    if (!teacherForm.department.trim()) errs.department = 'Department is required'
    if (teacherForm.hourly_rate === '' || Number.isNaN(Number(teacherForm.hourly_rate))) {
      errs.hourly_rate = 'Hourly rate is required'
    } else if (Number(teacherForm.hourly_rate) < 0) {
      errs.hourly_rate = 'Hourly rate cannot be negative'
    }

    if (Object.keys(errs).length) {
      setTeacherFormErrors(errs)
      return
    }

    setLoading(true)
    try {
      const path = editTeacherId ? `/teachers/${editTeacherId}` : '/teachers'
      await apiRequest(
        path,
        {
          method: editTeacherId ? 'PUT' : 'POST',
          body: JSON.stringify({
            ...teacherForm,
            hourly_rate: Number(teacherForm.hourly_rate || 0),
          }),
        },
        token,
      )

      setTeacherForm(emptyTeacher)
      setEditTeacherId(null)
      setFormOpen(false)
      setTeacherFormErrors({})
      setTeacherModalError('')
      await loadTeachers()
    } catch (err) {
      setTeacherModalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const deleteTeacher = async () => {
    if (!isAdmin || !deleteTarget) {
      return
    }

    setError('')
    setLoading(true)
    try {
      await apiRequest(`/teachers/${deleteTarget.id}`, { method: 'DELETE' }, token)
      setDeleteTarget(null)
      await loadTeachers()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeachers = useMemo(() => {
    if (!query.trim()) {
      return teachers
    }

    const search = query.toLowerCase()
    return teachers.filter((teacher) =>
      [teacher.employee_no, teacher.first_name, teacher.last_name, teacher.department]
        .join(' ')
        .toLowerCase()
        .includes(search),
    )
  }, [query, teachers])

  const createAccount = async () => {
    if (!isAdmin || !accountTarget) return

    setError('')
    setAccountFormErrors({})
    setAccountModalError('')

    const errs = {}
    if (!accountForm.username.trim()) errs.username = 'Username is required'
    if (!accountForm.password.trim()) errs.password = 'Password is required'
    if (Object.keys(errs).length) {
      setAccountFormErrors(errs)
      return
    }

    setLoading(true)
    try {
      await apiRequest(
        '/auth/teacher-account',
        {
          method: 'POST',
          body: JSON.stringify({
            teacher_id: accountTarget.id,
            username: accountForm.username,
            password: accountForm.password,
          }),
        },
        token,
      )
      setAccountTarget(null)
      setAccountForm({ username: '', password: '' })
      setAccountFormErrors({})
      setAccountModalError('')
      await loadTeachers()
    } catch (err) {
      setAccountModalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const submitResetPassword = async () => {
    if (!isAdmin || !resetTarget) return

    setError('')
    setResetFormErrors({})
    setResetModalError('')

    const errs = {}
    if (!resetPassword.trim()) errs.password = 'Password is required'
    if (Object.keys(errs).length) {
      setResetFormErrors(errs)
      return
    }

    setLoading(true)
    try {
      await apiRequest(
        '/auth/reset-password',
        {
          method: 'PUT',
          body: JSON.stringify({
            teacher_id: resetTarget.id,
            new_password: resetPassword,
          }),
        },
        token,
      )
      setResetTarget(null)
      setResetPassword('')
      setResetFormErrors({})
      setResetModalError('')
    } catch (err) {
      setResetModalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const downloadQrCode = () => {
    if (!qrTarget || !qrDataUrl) return

    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `${qrTarget.employee_no}-qr.png`
    link.click()
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Teachers</h2>
        {isAdmin ? (
          <Button
            icon={<Icon name="plus" />}
            onClick={() => {
              setEditTeacherId(null)
              setTeacherForm(emptyTeacher)
              setFormOpen(true)
            }}
          >
            Add teacher
          </Button>
        ) : null}
      </div>

      <div className="flex gap-2 mb-4">
        <input
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by employee no, name, department"
        />
        <Button variant="secondary" icon={<Icon name="search" />}>Search</Button>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Employee No</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Hourly Rate</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Account</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">QR</th>
              {isAdmin ? <th className="px-4 py-3 text-left font-medium text-gray-600 w-[1%] whitespace-nowrap">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-gray-500">No teachers found</td>
              </tr>
            ) : null}
            {filteredTeachers.map((teacher) => (
              <tr key={teacher.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">{teacher.employee_no}</td>
                <td className="px-4 py-3">{teacher.last_name}, {teacher.first_name}</td>
                <td className="px-4 py-3">{teacher.department}</td>
                <td className="px-4 py-3">₱{Number(teacher.hourly_rate).toFixed(2)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${teacher.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{teacher.status}</span>
                </td>
                <td className="px-4 py-3">
                  {teacher.has_account ? (
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800">{teacher.account_username}</span>
                      {isAdmin ? (
                        <button
                          className="text-xs text-amber-700 hover:underline cursor-pointer"
                          onClick={() => {
                            setResetTarget(teacher)
                            setShowResetPassword(false)
                          }}
                        >
                          Reset
                        </button>
                      ) : null}
                    </div>
                  ) : isAdmin ? (
                    <button
                      className="text-xs text-blue-800 hover:underline cursor-pointer"
                      onClick={() => {
                        setAccountTarget(teacher)
                        setAccountForm({ username: teacher.employee_no, password: teacher.employee_no })
                      }}
                    >
                      Create Account
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">None</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="secondary"
                    icon={<Icon name="qr-scan" />}
                    onClick={() => setQrTarget(teacher)}
                  >
                    View QR
                  </Button>
                </td>
                {isAdmin ? (
                  <td className="px-4 py-3">
                    <ActionButtons
                      onEdit={() => {
                        setEditTeacherId(teacher.id)
                        setTeacherForm({
                          employee_no: teacher.employee_no,
                          first_name: teacher.first_name,
                          last_name: teacher.last_name,
                          department: teacher.department,
                          hourly_rate: teacher.hourly_rate,
                          status: teacher.status,
                        })
                        setFormOpen(true)
                      }}
                      onDelete={() => setDeleteTarget(teacher)}
                      disabled={loading}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        title={editTeacherId ? 'Edit Teacher' : 'Add Teacher'}
        onClose={() => setFormOpen(false)}
        onConfirm={saveTeacher}
        confirmLabel={editTeacherId ? 'Save Changes' : 'Create Teacher'}
        confirmVariant="primary"
        busy={loading}
      >
        <div className="grid gap-4">
          {teacherModalError ? (
            <p className="text-sm text-red-600">{teacherModalError}</p>
          ) : null}
          {Object.keys(teacherFormErrors).length ? (
            <p className="text-sm text-red-600">Please fix the highlighted fields.</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Employee No
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.employee_no}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, employee_no: event.target.value }))}
            />
            {teacherFormErrors.employee_no ? (
              <span className="text-xs text-red-600">{teacherFormErrors.employee_no}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            First Name
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.first_name}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, first_name: event.target.value }))}
            />
            {teacherFormErrors.first_name ? (
              <span className="text-xs text-red-600">{teacherFormErrors.first_name}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Last Name
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.last_name}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, last_name: event.target.value }))}
            />
            {teacherFormErrors.last_name ? (
              <span className="text-xs text-red-600">{teacherFormErrors.last_name}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Department
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.department}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, department: event.target.value }))}
            />
            {teacherFormErrors.department ? (
              <span className="text-xs text-red-600">{teacherFormErrors.department}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Hourly Rate
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type="number"
              min="0"
              step="0.01"
              value={teacherForm.hourly_rate}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, hourly_rate: event.target.value }))}
            />
            {teacherFormErrors.hourly_rate ? (
              <span className="text-xs text-red-600">{teacherFormErrors.hourly_rate}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Status
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.status}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        title="Delete Teacher"
        onClose={() => setDeleteTarget(null)}
        onConfirm={deleteTeacher}
        confirmLabel="Delete"
        confirmVariant="danger"
        busy={loading}
      >
        <p>
          Delete <strong>{deleteTarget ? `${deleteTarget.last_name}, ${deleteTarget.first_name}` : ''}</strong>? This action
          cannot be undone.
        </p>
      </Modal>

      <Modal
        open={Boolean(accountTarget)}
        title="Create Teacher Account"
        onClose={() => setAccountTarget(null)}
        onConfirm={createAccount}
        confirmLabel="Create Account"
        confirmVariant="primary"
        busy={loading}
      >
        <p className="text-sm text-gray-600 mb-4">
          Create a login account for <strong>{accountTarget ? `${accountTarget.first_name} ${accountTarget.last_name}` : ''}</strong>.
        </p>
        <div className="grid gap-4">
          {accountModalError ? (
            <p className="text-sm text-red-600">{accountModalError}</p>
          ) : null}
          {Object.keys(accountFormErrors).length ? (
            <p className="text-sm text-red-600">Please fix the highlighted fields.</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Username
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={accountForm.username}
              onChange={(e) => setAccountForm((prev) => ({ ...prev, username: e.target.value }))}
            />
            {accountFormErrors.username ? (
              <span className="text-xs text-red-600">{accountFormErrors.username}</span>
            ) : null}
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Password
            <div className="relative">
              <input
                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                type={showAccountPassword ? 'text' : 'password'}
                value={accountForm.password}
                onChange={(e) => setAccountForm((prev) => ({ ...prev, password: e.target.value }))}
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                onClick={() => setShowAccountPassword((prev) => !prev)}
                tabIndex={-1}
              >
                <Icon name={showAccountPassword ? 'eye-off' : 'eye'} className="w-4 h-4" />
              </button>
            </div>
            {accountFormErrors.password ? (
              <span className="text-xs text-red-600">{accountFormErrors.password}</span>
            ) : null}
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        title="Reset Password"
        onClose={() => setResetTarget(null)}
        onConfirm={submitResetPassword}
        confirmLabel="Reset Password"
        confirmVariant="danger"
        busy={loading}
      >
        <p className="text-sm text-gray-600 mb-4">
          Reset password for <strong>{resetTarget ? `${resetTarget.first_name} ${resetTarget.last_name}` : ''}</strong> ({resetTarget?.account_username}).
        </p>
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          New Password
          <div className="relative">
            <input
              className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              type={showResetPassword ? 'text' : 'password'}
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
              onClick={() => setShowResetPassword((prev) => !prev)}
              tabIndex={-1}
            >
              <Icon name={showResetPassword ? 'eye-off' : 'eye'} className="w-4 h-4" />
            </button>
          </div>
          {resetFormErrors.password ? (
            <span className="text-xs text-red-600">{resetFormErrors.password}</span>
          ) : null}
          {resetModalError ? (
            <span className="text-xs text-red-600">{resetModalError}</span>
          ) : null}
        </label>
      </Modal>

      <Modal
        open={Boolean(qrTarget)}
        title="Teacher QR Code"
        onClose={() => setQrTarget(null)}
        onConfirm={downloadQrCode}
        confirmLabel={qrGenerating ? 'Generating...' : 'Download QR'}
        confirmVariant="primary"
        busy={false}
      >
        <div className="text-center space-y-3">
          <p className="text-sm text-gray-600">
            Scan this to record attendance for{' '}
            <strong>{qrTarget ? `${qrTarget.first_name} ${qrTarget.last_name}` : ''}</strong>.
          </p>

          <div className="flex justify-center">
            {qrGenerating ? (
              <span className="text-gray-500 text-sm">Generating QR...</span>
            ) : qrError ? (
              <span className="text-red-600 text-sm">{qrError}</span>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR code for ${qrTarget?.employee_no || 'teacher'}`}
                className="w-48 h-48 border border-gray-200 rounded-lg shadow-sm bg-white p-3"
              />
            ) : null}
          </div>

          <p className="text-xs text-gray-500">Encodes employee no: {qrTarget?.employee_no}</p>
        </div>
      </Modal>
    </section>
  )
}
