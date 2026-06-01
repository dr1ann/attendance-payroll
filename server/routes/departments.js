import { Router } from 'express'
import { getConnection, query } from '../db.js'
import { authorizeRoles } from '../middleware/auth.js'

export const departmentsRouter = Router()

function validateDepartmentPayload(payload) {
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const status = typeof payload.status === 'string' ? payload.status.trim() : 'active'

  if (!name) {
    return { message: 'Department name is required' }
  }

  if (!['active', 'inactive'].includes(status)) {
    return { message: 'Department status must be active or inactive' }
  }

  return { name, status }
}

departmentsRouter.get('/', authorizeRoles('admin'), async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status.trim() : ''
  const params = []

  let sql = `
    SELECT id, name, status, created_at, updated_at
    FROM departments
  `

  if (['active', 'inactive'].includes(status)) {
    sql += ' WHERE status = ?'
    params.push(status)
  }

  sql += " ORDER BY CASE WHEN status = 'active' THEN 0 ELSE 1 END, name ASC"

  try {
    const rows = await query(sql, params)
    return res.json(rows)
  } catch (err) {
    // Recover from missing table by creating and seeding it, then retrying
    if (err?.code === 'ER_NO_SUCH_TABLE' || err?.errno === 1146) {
      await query(`
        CREATE TABLE IF NOT EXISTS departments (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100) NOT NULL UNIQUE,
          status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `)

      await query(`
        INSERT IGNORE INTO departments (name)
        SELECT DISTINCT TRIM(department)
        FROM teachers
        WHERE department IS NOT NULL AND TRIM(department) <> ''
      `)

      const rows = await query(sql, params)
      return res.json(rows)
    }

    throw err
  }
})

departmentsRouter.post('/', authorizeRoles('admin'), async (req, res) => {
  const validation = validateDepartmentPayload(req.body)
  if (validation.message) {
    return res.status(400).json({ message: validation.message })
  }

  try {
    await query(
      `INSERT INTO departments (name, status)
       VALUES (?, ?)`,
      [validation.name, validation.status],
    )
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Department already exists' })
    }
    throw err
  }

  return res.status(201).json({ message: 'Department created' })
})

departmentsRouter.put('/:id', authorizeRoles('admin'), async (req, res) => {
  const validation = validateDepartmentPayload(req.body)
  if (validation.message) {
    return res.status(400).json({ message: validation.message })
  }

  const connection = await getConnection()

  try {
    await connection.beginTransaction()

    const [existingRows] = await connection.query(
      `SELECT id, name, status
       FROM departments
       WHERE id = ?
       LIMIT 1`,
      [req.params.id],
    )

    const existingDepartment = existingRows[0]
    if (!existingDepartment) {
      await connection.rollback()
      return res.status(404).json({ message: 'Department not found' })
    }

    const [duplicateRows] = await connection.query(
      `SELECT id
       FROM departments
       WHERE name = ? AND id <> ?
       LIMIT 1`,
      [validation.name, req.params.id],
    )

    if (duplicateRows[0]) {
      await connection.rollback()
      return res.status(409).json({ message: 'Department already exists' })
    }

    if (existingDepartment.name !== validation.name) {
      await connection.query(
        `UPDATE teachers
         SET department = ?
         WHERE department = ?`,
        [validation.name, existingDepartment.name],
      )
    }

    await connection.query(
      `UPDATE departments
       SET name = ?, status = ?
       WHERE id = ?`,
      [validation.name, validation.status, req.params.id],
    )

    await connection.commit()
  } catch (err) {
    await connection.rollback()

    if (err?.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ message: 'Department already exists' })
    }

    throw err
  } finally {
    connection.release()
  }

  return res.json({ message: 'Department updated' })
})