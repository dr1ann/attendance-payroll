import './App.css'
import { AuthProvider } from './context/AuthContext'
import AppRouter from './app/AppRouter'

function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  )
}

export default App
