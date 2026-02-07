import { create } from 'zustand'

const useAppStore = create((set) => ({
  user: null,
  authLoading: true,
  notes: [],
  searchQuery: '',
  activeFilter: 'all',
  settings: {
    language: 'ru',
    theme: 'dark',
    editor: {
      autoSave: true,
      cursorBehavior: 'preserve',
      mode: 'rich'
    },
    sidebar: {
      isOpen: true
    }
  },
  setUser: (user) => set({ user }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setNotes: (notes) => set({ notes }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setActiveFilter: (activeFilter) => set({ activeFilter }),
  setSettings: (settings) => set({ settings }),
  updateSettings: (partial) =>
    set((state) => ({
      settings: {
        ...state.settings,
        ...partial,
        editor: {
          ...state.settings.editor,
          ...(partial.editor || {})
        },
        sidebar: {
          ...state.settings.sidebar,
          ...(partial.sidebar || {})
        }
      }
    }))
}))

export default useAppStore
