import { create } from 'zustand'

interface UserState {
  balance: number
  xp: number
  username: string | null
  id: string | null
  isAdmin: boolean
  isSidebarOpen: boolean
  lastDecayCheckedAt: string | null
  eventTickets: number
  lastCheckinAt: string | null
  checkinStreak: number
  advertiserTokens: number
  setBalance: (balance: number) => void
  setXp: (xp: number) => void
  setEventTickets: (tickets: number) => void
  setCheckinStreak: (streak: number) => void
  setLastCheckinAt: (date: string | null) => void
  setAdvertiserTokens: (tokens: number) => void
  setUser: (user: { id: string; username: string | null; balance: number; advertiser_tokens?: number; xp: number; isAdmin: boolean; eventTickets?: number; lastCheckinAt?: string | null; checkinStreak?: number; lastDecayCheckedAt?: string | null }) => void
  toggleSidebar: () => void
  reset: () => void
}

export const useStore = create<UserState>((set) => ({
  balance: 0,
  xp: 0,
  username: null,
  id: null,
  isAdmin: false,
  isSidebarOpen: true,
  lastDecayCheckedAt: null,
  eventTickets: 0,
  lastCheckinAt: null,
  checkinStreak: 0,
  advertiserTokens: 0,
  setBalance: (balance) => set({ balance }),
  setXp: (xp) => set({ xp }),
  setEventTickets: (eventTickets) => set({ eventTickets }),
  setCheckinStreak: (checkinStreak) => set({ checkinStreak }),
  setLastCheckinAt: (lastCheckinAt) => set({ lastCheckinAt }),
  setAdvertiserTokens: (advertiserTokens) => set({ advertiserTokens }),
  setUser: (user) => set({ 
    id: user.id, 
    username: user.username, 
    balance: user.balance, 
    advertiserTokens: user.advertiser_tokens || 0,
    xp: user.xp, 
    isAdmin: user.isAdmin, 
    eventTickets: user.eventTickets || 0,
    lastCheckinAt: user.lastCheckinAt || null,
    checkinStreak: user.checkinStreak || 0,
    lastDecayCheckedAt: user.lastDecayCheckedAt || null 
  }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  reset: () => set({ balance: 0, xp: 0, username: null, id: null, isAdmin: false, isSidebarOpen: true, lastDecayCheckedAt: null, eventTickets: 0, lastCheckinAt: null, checkinStreak: 0, advertiserTokens: 0 }),
}))
