import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import AppLayout from '../layout/AppLayout'
import LoginPage from '../pages/LoginPage'
import DashboardPage from '../pages/DashboardPage'
import TeachersPage from '../pages/TeachersPage'
import DepartmentsPage from '../pages/DepartmentsPage'
import ReportsPage from '../pages/ReportsPage'
import SchedulesPage from '../pages/SchedulesPage'
import SettingsPage from '../pages/SettingsPage'
import ScanPage from '../pages/ScanPage'
import AttendancePage from '../pages/AttendancePage'
import MyAttendancePage from '../pages/MyAttendancePage'
import SalaryComputationPage from '../pages/SalaryComputationPage'
import TeacherScanPage from '../pages/TeacherScanPage'

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/teacher-scan" element={<TeacherScanPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/attendance" element={<AttendancePage />} />
          <Route path="/my-attendance" element={<MyAttendancePage />} />
          <Route path="/salary-computation" element={<SalaryComputationPage />} />
          <Route path="/teachers" element={<TeachersPage />} />
          <Route path="/departments" element={<DepartmentsPage />} />
          <Route path="/schedules" element={<SchedulesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
