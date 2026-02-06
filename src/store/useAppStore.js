import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  authLoading: true,
  notes: [],
  searchQuery: '',
  activeFilter: 'all',
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setNotes: (notes) => set({ notes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveFilter: (activeFilter) => set({ activeFilter })
}))

export default useAppStore
