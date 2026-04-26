import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from '../contexts/AuthContext'

function ProtectedRoute({ children }) {
  const { session, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white">로딩 중...</div>
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return children
}

export default ProtectedRoute
