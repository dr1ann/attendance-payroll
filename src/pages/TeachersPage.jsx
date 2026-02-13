import { useCallback, useEffect, useMemo, useState } from 'react'
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
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadTeachers = useCallback(async () => {
    const rows = await apiRequest('/teachers', {}, token)
    setTeachers(rows)
  }, [token])

  useEffect(() => {
    loadTeachers().catch((err) => setError(err.message))
  }, [loadTeachers])

  const saveTeacher = async () => {
    if (!isAdmin) {
      return
    }

    setError('')
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
      await loadTeachers()
    } catch (err) {
      setError(err.message)
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
              {isAdmin ? <th className="px-4 py-3 text-left font-medium text-gray-600 w-[1%] whitespace-nowrap">Actions</th> : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredTeachers.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 6 : 5} className="px-4 py-8 text-center text-gray-500">No teachers found</td>
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
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Employee No
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.employee_no}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, employee_no: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            First Name
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.first_name}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, first_name: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Last Name
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.last_name}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, last_name: event.target.value }))}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Department
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={teacherForm.department}
              onChange={(event) => setTeacherForm((prev) => ({ ...prev, department: event.target.value }))}
            />
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
    </section>
  )
}
