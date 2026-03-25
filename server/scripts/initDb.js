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
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
}

const dbName = process.env.DB_NAME
const adminUsername = process.env.ADMIN_USERNAME
const adminPassword = process.env.ADMIN_PASSWORD

async function init() {
  const connection = await mysql.createConnection(config)

  await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbName}`)
  await connection.query(`USE ${dbName}`)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT PRIMARY KEY AUTO_INCREMENT,
      username VARCHAR(100) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'payroll_viewer', 'teacher') NOT NULL DEFAULT 'admin',
      teacher_id INT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)

  // Ensure existing table has teacher role and teacher_id column
  await connection.query(`
    ALTER TABLE users
    MODIFY COLUMN role ENUM('admin', 'payroll_viewer', 'teacher') NOT NULL DEFAULT 'admin'
  `)

  const [cols] = await connection.query(`
    SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users' AND COLUMN_NAME = 'teacher_id'
  `, [dbName])

  if (cols.length === 0) {
    await connection.query(`
      ALTER TABLE users ADD COLUMN teacher_id INT NULL
    `)
  }

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

  await connection.query(`
    CREATE TABLE IF NOT EXISTS attendance (
      id INT PRIMARY KEY AUTO_INCREMENT,
      teacher_id INT NOT NULL,
      schedule_id INT,
      scan_time DATETIME NOT NULL,
      scan_type ENUM('time_in', 'time_out') NOT NULL,
      status ENUM('on_time', 'late') NOT NULL DEFAULT 'on_time',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_attendance_teacher
        FOREIGN KEY (teacher_id) REFERENCES teachers(id)
        ON DELETE CASCADE,
      CONSTRAINT fk_attendance_schedule
        FOREIGN KEY (schedule_id) REFERENCES schedules(id)
        ON DELETE SET NULL
    )
  `)

  const passwordHash = await bcrypt.hash(adminPassword, 10)
  await connection.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, 'admin')
     ON DUPLICATE KEY UPDATE
       password_hash = VALUES(password_hash),
       role = 'admin',
       teacher_id = NULL`,
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
