/* eslint-disable react/prop-types -- children-only wrapper */
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import Splash from './Splash.jsx'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <Splash />
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (children == null) {
    return <Outlet />
  }

  return children
}
