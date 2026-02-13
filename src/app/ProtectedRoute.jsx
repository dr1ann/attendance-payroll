import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function ProtectedRoute() {
  const { authLoading, isAuthenticated } = useAuth()

  if (authLoading) {
    return (
      <main className="page">
        <section className="panel">
          <p>Loading session...</p>
        </section>
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
