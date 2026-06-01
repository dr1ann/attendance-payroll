import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { useAuth } from '../context/useAuth'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import Icon from '../components/ui/Icon'

const emptyDepartment = {
  name: '',
  status: 'active',
}

export default function DepartmentsPage() {
  const { token, isAdmin } = useAuth()
  const [departments, setDepartments] = useState([])
  const [departmentForm, setDepartmentForm] = useState(emptyDepartment)
  const [editDepartmentId, setEditDepartmentId] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [formErrors, setFormErrors] = useState({})
  const [modalError, setModalError] = useState('')

  const loadDepartments = useCallback(async () => {
    const rows = await apiRequest('/departments', {}, token)
    setDepartments(rows)
  }, [token])

  useEffect(() => {
    loadDepartments().catch((err) => setError(err.message))
  }, [loadDepartments])

  const sortedDepartments = useMemo(
    () =>
      departments.slice().sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1
        }

        return a.name.localeCompare(b.name)
      }),
    [departments],
  )

  const openCreateForm = () => {
    setEditDepartmentId(null)
    setDepartmentForm(emptyDepartment)
    setFormErrors({})
    setModalError('')
    setFormOpen(true)
  }

  const openEditForm = (department) => {
    setEditDepartmentId(department.id)
    setDepartmentForm({
      name: department.name,
      status: department.status,
    })
    setFormErrors({})
    setModalError('')
    setFormOpen(true)
  }

  const saveDepartment = async () => {
    if (!isAdmin) {
      return
    }

    setError('')
    setFormErrors({})
    setModalError('')

    const errs = {}
    if (!departmentForm.name.trim()) {
      errs.name = 'Department name is required'
    }
    if (!['active', 'inactive'].includes(departmentForm.status)) {
      errs.status = 'Department status is required'
    }

    if (Object.keys(errs).length) {
      setFormErrors(errs)
      return
    }

    setLoading(true)
    try {
      const path = editDepartmentId ? `/departments/${editDepartmentId}` : '/departments'
      await apiRequest(
        path,
        {
          method: editDepartmentId ? 'PUT' : 'POST',
          body: JSON.stringify({
            name: departmentForm.name.trim(),
            status: departmentForm.status,
          }),
        },
        token,
      )

      setDepartmentForm(emptyDepartment)
      setEditDepartmentId(null)
      setFormOpen(false)
      await loadDepartments()
    } catch (err) {
      setModalError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <section>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Departments</h2>
        <p className="text-sm text-gray-600">Only administrators can manage departments.</p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Departments</h2>
          <p className="mt-1 text-sm text-gray-500">
            Inactive departments stay on file, but they cannot be selected for new teachers.
          </p>
        </div>
        <Button icon={<Icon name="plus" />} onClick={openCreateForm}>
          Add department
        </Button>
      </div>

      {error ? <p className="text-red-600 text-sm mb-4">{error}</p> : null}

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Department</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Updated</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600 w-[1%] whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sortedDepartments.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No departments found
                </td>
              </tr>
            ) : null}

            {sortedDepartments.map((department) => (
              <tr key={department.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{department.name}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      department.status === 'active'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {department.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {department.updated_at ? new Date(department.updated_at).toLocaleString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <Button variant="secondary" onClick={() => openEditForm(department)} icon={<Icon name="edit" />}>
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal
        open={formOpen}
        title={editDepartmentId ? 'Edit Department' : 'Add Department'}
        onClose={() => setFormOpen(false)}
        onConfirm={saveDepartment}
        confirmLabel={editDepartmentId ? 'Save Changes' : 'Create Department'}
        confirmVariant="primary"
        busy={loading}
      >
        <div className="grid gap-4">
          {modalError ? <p className="text-sm text-red-600">{modalError}</p> : null}
          {Object.keys(formErrors).length ? (
            <p className="text-sm text-red-600">Please fix the highlighted fields.</p>
          ) : null}

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Department Name
            <input
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={departmentForm.name}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
            />
            {formErrors.name ? <span className="text-xs text-red-600">{formErrors.name}</span> : null}
          </label>

          <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
            Status
            <select
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={departmentForm.status}
              onChange={(event) => setDepartmentForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {formErrors.status ? <span className="text-xs text-red-600">{formErrors.status}</span> : null}
          </label>
        </div>
      </Modal>
    </section>
  )
}
