import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore, initAuth } from './store/useAuthStore'
import { supabase } from './lib/supabase'

import NavBar          from './components/layout/NavBar'
import LoginRegister   from './pages/LoginRegister'
import OnboardingQuiz  from './pages/OnboardingQuiz'
import Catalogue       from './pages/Catalogue'
import PerfumeDetail   from './pages/PerfumeDetail'
import BrandPage       from './pages/BrandPage'
import MyCollection    from './pages/MyCollection'
import Wishlist        from './pages/Wishlist'
import Profile         from './pages/Profile'
import Recommendations from './pages/Recommendations'
import AdminDashboard  from './pages/AdminDashboard'
import QueryConsole    from './pages/QueryConsole'

function AuthInit() {
  const { setSession, setProfile, user } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    initAuth(setSession, setProfile)
  }, [])

  useEffect(() => {
    if (!user) return
    supabase
      .from('quiz_responses')
      .select('user_id')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (!data) navigate('/onboarding')
      })
  }, [user])

  return null
}

function RequireAuth({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  return user ? children : <Navigate to="/login" replace />
}

function RequireAdmin({ children }) {
  const { user, loading } = useAuthStore()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthInit />
      <NavBar />
      <Routes>
        <Route path="/"            element={<Catalogue />} />
        <Route path="/perfume/:id" element={<PerfumeDetail />} />
        <Route path="/brand/:id"   element={<BrandPage />} />
        <Route path="/login"       element={<LoginRegister />} />

        <Route path="/onboarding"      element={<RequireAuth><OnboardingQuiz /></RequireAuth>} />
        <Route path="/recommendations" element={<RequireAuth><Recommendations /></RequireAuth>} />
        <Route path="/my-collection"   element={<RequireAuth><MyCollection /></RequireAuth>} />
        <Route path="/wishlist"        element={<RequireAuth><Wishlist /></RequireAuth>} />
        <Route path="/profile"         element={<RequireAuth><Profile /></RequireAuth>} />

        <Route path="/admin"   element={<RequireAdmin><AdminDashboard /></RequireAdmin>} />
        <Route path="/console" element={<RequireAuth><QueryConsole /></RequireAuth>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
