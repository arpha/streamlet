import { create } from 'zustand'

interface UserState {
  balance: number
  xp: number
  username: string | null
  id: string | null
  isSidebarOpen: boolean
  setBalance: (balance: number) => void
  setXp: (xp: number) => void
  setUser: (user: { id: string; username: string | null; balance: number; xp: number }) => void
  toggleSidebar: () => void
  reset: () => void
}

export const useStore = create<UserState>((set) => ({
  balance: 0,
  xp: 0,
  username: null,
  id: null,
  isSidebarOpen: true,
  setBalance: (balance) => set({ balance }),
  setXp: (xp) => set({ xp }),
  setUser: (user) => set({ id: user.id, username: user.username, balance: user.balance, xp: user.xp }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  reset: () => set({ balance: 0, xp: 0, username: null, id: null, isSidebarOpen: true }),
}))
