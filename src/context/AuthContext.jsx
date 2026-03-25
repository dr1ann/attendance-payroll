import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../api'
import { AuthContext } from './authContextObject'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token') || '')
  const [user, setUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(Boolean(localStorage.getItem('token')))

  const logout = useCallback(() => {
    setToken('')
    setUser(null)
    setAuthLoading(false)
    localStorage.removeItem('token')
  }, [])

  const refreshProfile = useCallback(async (activeToken = token) => {
    if (!activeToken) {
      setUser(null)
      return null
    }

    const profile = await apiRequest('/auth/me', {}, activeToken)
    setUser(profile)
    return profile
  }, [token])

  const login = useCallback(async (credentials) => {
    const payload = await apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })

    setToken(payload.token)
    setUser(payload.user)
    localStorage.setItem('token', payload.token)
    return payload.user
  }, [])

  useEffect(() => {
    const bootstrap = async () => {
      if (!token) {
        setAuthLoading(false)
        return
      }

      try {
        await refreshProfile(token)
      } catch {
        logout()
      } finally {
        setAuthLoading(false)
      }
    }

    bootstrap()
  }, [logout, refreshProfile, token])

  const value = useMemo(
    () => ({
      token,
      user,
      authLoading,
      isAuthenticated: Boolean(token && user),
      isAdmin: user?.role === 'admin',
      isTeacher: user?.role === 'teacher',
      isPayrollViewer: user?.role === 'payroll_viewer',
      login,
      logout,
      refreshProfile,
    }),
    [authLoading, login, logout, refreshProfile, token, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
