import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  profile: null,
  loading: true,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  setProfile: (profile) => set({ profile }),
  setLoading: (loading) => set({ loading }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null, profile: null })
  },
}))

// Fetch the profile row for a given user id; returns null on error / no row.
async function fetchProfile(userId) {
  if (!userId) return null
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data ?? null
}

// Call this once in App.jsx
export async function initAuth(setSession, setProfile) {
  const store = useAuthStore.getState()
  store.setLoading(true)

  const { data: { session } } = await supabase.auth.getSession()
  setSession(session)

  if (session?.user && setProfile) {
    const profile = await fetchProfile(session.user.id)
    setProfile(profile)
  }

  store.setLoading(false)

  supabase.auth.onAuthStateChange(async (_event, session) => {
    setSession(session)
    if (setProfile) {
      const profile = session?.user ? await fetchProfile(session.user.id) : null
      setProfile(profile)
    }
  })
}
