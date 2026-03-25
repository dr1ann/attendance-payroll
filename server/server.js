import express from 'express'
import cors from 'cors'
import { authRouter } from './routes/auth.js'
import { teachersRouter } from './routes/teachers.js'
import { schedulesRouter } from './routes/schedules.js'
import { settingsRouter } from './routes/settings.js'
import { attendanceRouter } from './routes/attendance.js'
import { authenticateToken } from './middleware/auth.js'

const app = express()
const port = Number(process.env.PORT || 4000)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'attendance-payroll-api' })
})

app.use('/api/auth', authRouter)
app.use('/api/teachers', authenticateToken, teachersRouter)
app.use('/api/schedules', authenticateToken, schedulesRouter)
app.use('/api/settings', authenticateToken, settingsRouter)
app.use('/api/attendance', authenticateToken, attendanceRouter)

app.use((err, _, res, next) => {
  void next
  console.error(err)
  res.status(500).json({ message: 'Internal server error' })
})

app.listen(port, () => {
  console.log(`API running on http://localhost:${port}`)
})
