import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { authenticateToken, authorizeRoles } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  const users = await query(
    'SELECT id, username, password_hash, role, teacher_id FROM users WHERE username = ? LIMIT 1',
    [username],
  )

  const user = users[0]
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const ok = await bcrypt.compare(password, user.password_hash)
  if (!ok) {
    return res.status(401).json({ message: 'Invalid credentials' })
  }

  const token = jwt.sign(
    { sub: user.id, username: user.username, role: user.role, teacher_id: user.teacher_id },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' },
  )

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      teacher_id: user.teacher_id,
    },
  })
})

authRouter.get('/me', authenticateToken, async (req, res) => {
  const users = await query(
    'SELECT id, username, role, teacher_id FROM users WHERE id = ? LIMIT 1',
    [req.user.sub],
  )

  const user = users[0]
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  return res.json(user)
})

// POST /api/auth/teacher-account - Admin creates a login account for a teacher
authRouter.post(
  '/teacher-account',
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res) => {
    const { teacher_id, username, password } = req.body

    if (!teacher_id || !username || !password) {
      return res.status(400).json({ message: 'teacher_id, username, and password are required' })
    }

    // Verify teacher exists
    const [teacher] = await query('SELECT id FROM teachers WHERE id = ?', [teacher_id])
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' })
    }

    // Check if teacher already has an account
    const [existing] = await query('SELECT id FROM users WHERE teacher_id = ?', [teacher_id])
    if (existing) {
      return res.status(400).json({ message: 'This teacher already has an account' })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    await query(
      'INSERT INTO users (username, password_hash, role, teacher_id) VALUES (?, ?, ?, ?)',
      [username, passwordHash, 'teacher', teacher_id],
    )

    return res.status(201).json({ message: 'Teacher account created' })
  },
)

// PUT /api/auth/reset-password - Admin resets a teacher's password
authRouter.put(
  '/reset-password',
  authenticateToken,
  authorizeRoles('admin'),
  async (req, res) => {
    const { teacher_id, new_password } = req.body

    if (!teacher_id || !new_password) {
      return res.status(400).json({ message: 'teacher_id and new_password are required' })
    }

    const [user] = await query('SELECT id FROM users WHERE teacher_id = ?', [teacher_id])
    if (!user) {
      return res.status(404).json({ message: 'No account found for this teacher' })
    }

    const passwordHash = await bcrypt.hash(new_password, 10)
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id])

    return res.json({ message: 'Password reset successfully' })
  },
)

// PUT /api/auth/change-password - Any logged-in user changes their own password
authRouter.put(
  '/change-password',
  authenticateToken,
  async (req, res) => {
    const { current_password, new_password } = req.body

    if (!current_password || !new_password) {
      return res.status(400).json({ message: 'Current password and new password are required' })
    }

    const [user] = await query('SELECT id, password_hash FROM users WHERE id = ?', [req.user.sub])
    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    const ok = await bcrypt.compare(current_password, user.password_hash)
    if (!ok) {
      return res.status(401).json({ message: 'Current password is incorrect' })
    }

    const passwordHash = await bcrypt.hash(new_password, 10)
    await query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, user.id])

    return res.json({ message: 'Password changed successfully' })
  },
)
