import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set) => ({
  session: null,
  user: null,
  setSession: (session) => set({ session, user: session?.user ?? null }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, user: null })
  }
}))

// Call this once in App.jsx
export async function initAuth(setSession) {
  const { data: { session } } = await supabase.auth.getSession()
  setSession(session)
  supabase.auth.onAuthStateChange((_event, session) => setSession(session))
}