import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db.js'
import { authenticateToken } from '../middleware/auth.js'

export const authRouter = Router()

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password are required' })
  }

  const users = await query(
    'SELECT id, username, password_hash, role FROM users WHERE username = ? LIMIT 1',
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
    { sub: user.id, username: user.username, role: user.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' },
  )

  return res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  })
})

authRouter.get('/me', authenticateToken, async (req, res) => {
  const users = await query(
    'SELECT id, username, role FROM users WHERE id = ? LIMIT 1',
    [req.user.sub],
  )

  const user = users[0]
  if (!user) {
    return res.status(404).json({ message: 'User not found' })
  }

  return res.json(user)
})
