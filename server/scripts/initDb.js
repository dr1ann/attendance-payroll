import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import mysql from 'mysql2/promise'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const envPath = path.resolve(__dirname, '..', '..', '.env')

dotenv.config({ path: envPath })

const config = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  port: Number(process.env.DB_PORT || 3306),
}

const dbName = process.env.DB_NAME || 'attendance_payroll'
const adminUsername = process.env.ADMIN_USERNAME || 'admin'
const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'

async function init() {
  const connection = await mysql.createConnection(config)

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`)
  await connection.query(`USE ${dbName}`)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'payroll_viewer') NOT NULL DEFAULT 'admin',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INT PRIMARY KEY AUTO_INCREMENT,
      employee_no VARCHAR(50) NOT NULL UNIQUE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      department VARCHAR(100) NOT NULL,
      hourly_rate DECIMAL(10,2) NOT NULL DEFAULT 0,
      status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INT PRIMARY KEY AUTO_INCREMENT,
      teacher_id INT NOT NULL,
      day_of_week TINYINT NOT NULL,
      time_start TIME NOT NULL,
      time_end TIME NOT NULL,
      grace_minutes INT NOT NULL DEFAULT 15,
      CONSTRAINT fk_schedules_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE CASCADE
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS school_calendar (
      id INT PRIMARY KEY AUTO_INCREMENT,
      calendar_date DATE NOT NULL UNIQUE,
      is_school_day TINYINT(1) NOT NULL DEFAULT 1,
      note VARCHAR(255)
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance_settings (
      id INT PRIMARY KEY,
      late_grace_minutes INT NOT NULL DEFAULT 15,
      duplicate_scan_window_minutes INT NOT NULL DEFAULT 5,
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Manila'
    )
  `)

  await connection.query(
    `INSERT IGNORE INTO attendance_settings (id, late_grace_minutes, duplicate_scan_window_minutes, timezone)
     VALUES (1, 15, 5, 'Asia/Manila')`,
  )

  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await connection.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE username = username`,
    [adminUsername, passwordHash],
  )

  await connection.end()

  console.log('Database initialized successfully')
  console.log(`Admin user: ${adminUsername}`)
}

init().catch((error) => {
  console.error('Failed to initialize database:', error.message)
  process.exit(1)
})
