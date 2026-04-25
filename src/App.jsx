import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import Navbar from './components/Navbar'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Benchmarks from './pages/Benchmarks'
import Analyze from './pages/Analyze'
import Competitor from './pages/Competitor'
import Creative from './pages/Creative'
import Trends from './pages/Trends'

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/benchmarks" element={<Benchmarks />} />
            <Route path="/analyze" element={<Analyze />} />
            <Route path="/competitor" element={<Competitor />} />
            <Route path="/creative" element={<Creative />} />
            <Route path="/trends" element={<Trends />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  )
}

export default App
