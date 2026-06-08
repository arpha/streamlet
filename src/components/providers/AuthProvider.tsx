"use client"

import { createContext, useContext, useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { useStore } from "@/store/useStore"
import { useRouter } from "next/navigation"

const AuthContext = createContext<any>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const setUser = useStore((state) => state.setUser)
  const resetUser = useStore((state) => state.reset)
  const [user, setUserState] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single()

          const userData = {
            id: session.user.id,
            username: profile?.username || session.user.email,
            balance: profile?.balance || 0,
            xp: profile?.xp || 0,
            isAdmin: profile?.is_admin || false,
            eventTickets: profile?.event_tickets || 0,
            lastCheckinAt: profile?.last_checkin_at || null,
            checkinStreak: profile?.checkin_streak || 0,
            lastDecayCheckedAt: profile?.last_decay_checked_at
          }
          setUser(userData)
          setUserState(session.user)
        } else {
          resetUser()
          setUserState(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, setUser, resetUser])

  return (
    <AuthContext.Provider value={{ supabase, user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
