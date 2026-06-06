import { create } from 'zustand'

interface UserState {
  balance: number
  xp: number
  username: string | null
  id: string | null
  isAdmin: boolean
  isSidebarOpen: boolean
  lastDecayCheckedAt: string | null
  setBalance: (balance: number) => void
  setXp: (xp: number) => void
  setUser: (user: { id: string; username: string | null; balance: number; xp: number; isAdmin: boolean; lastDecayCheckedAt?: string | null }) => void
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
  setBalance: (balance) => set({ balance }),
  setXp: (xp) => set({ xp }),
  setUser: (user) => set({ id: user.id, username: user.username, balance: user.balance, xp: user.xp, isAdmin: user.isAdmin, lastDecayCheckedAt: user.lastDecayCheckedAt || null }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  reset: () => set({ balance: 0, xp: 0, username: null, id: null, isAdmin: false, isSidebarOpen: true, lastDecayCheckedAt: null }),
}))
