import { create } from "zustand"

const useStore = create((set) => ({
  user: null,
  isAuthLoading: true,
  notes: [],
  searchQuery: "",
  selectedFolder: "All Notes",
  setUser: (user) => set({ user }),
  setIsAuthLoading: (isAuthLoading) => set({ isAuthLoading }),
  setNotes: (notes) => set({ notes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSelectedFolder: (selectedFolder) => set({ selectedFolder })
}))

export default useStore
