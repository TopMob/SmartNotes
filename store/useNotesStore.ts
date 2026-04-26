"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export interface Note {
  id: string
  title?: string
  content?: string
  folderId?: string | null
  createdAt?: number | string
  updatedAt?: number | string
  order?: number
  tags?: string[]
  pageTitles?: string[]
  pageDrawings?: string[]
  pageDrawingsRevision?: string
  lock?: { hash?: string | null; [key: string]: unknown } | null
  [key: string]: unknown
}

export interface Folder {
  id: string
  name: string
  description?: string
  isHidden?: boolean
  trashedAt?: number | string | null
  folderOrder?: number
  createdAt?: number | string
  [key: string]: unknown
}

export interface NotesFilterConfig {
  sort: string
  folders: string[]
  tags: string[]
  updatedWindowDays: number
}

export interface InterfaceConfig {
  showSavedFilters: boolean
  showTagFilter: boolean
  showUpdatedPeriodFilter: boolean
  [key: string]: unknown
}

export interface AppConfig {
  lang: "ru" | "en"
  folderViewMode: string
  reduceMotion: boolean
  editorTools: Record<string, boolean>
  interface: InterfaceConfig
  notesFilter: NotesFilterConfig
  [key: string]: unknown
}

export interface SaveStatus {
  status: string
  message: string
  updatedAt: number
}

export interface AdminAnalysisStatus {
  status: string
  message: string
  updatedAt: number
  processed: number | null
  provider: string
  uid: string
  processedUsers: number | null
}

export interface PaginationState {
  displayLimit: number
  renderStep: number
  pageSize: number
  hasMoreOwnedNotes: boolean
  loadingMoreOwnedNotes: boolean
  lastOwnedNoteDocument: unknown
  totalVisibleNotesCount: number
  renderedVisibleNotesCount: number
  searchActive: boolean
}

export interface DraftSettings {
  appearanceDraft: Record<string, unknown> | null
  originalUserSettings: Record<string, unknown> | null
  draftUserSettings: Record<string, unknown> | null
  editorDirty: boolean
  isEditing: boolean
  isTyping: boolean
  tempRating: number
}

export interface NotesStoreData {
  user: Record<string, unknown> | null
  notes: Note[]
  folders: Folder[]
  view: string
  activeFolderId: string | null
  activeNoteId: string | null
  searchQuery: string
  currentNote: Note | null
  tempRating: number
  config: AppConfig
  recording: boolean
  mediaRecorder: unknown
  editorDirty: boolean
  isEditing: boolean
  isTyping: boolean
  orderHistory: unknown[]
  appearanceDraft: Record<string, unknown> | null
  originalUserSettings: Record<string, unknown> | null
  draftUserSettings: Record<string, unknown> | null
  saveStatus: SaveStatus
  adminAnalysisStatus: AdminAnalysisStatus
  pagination: PaginationState
}

export interface NotesStoreState extends NotesStoreData {
  draftSettings: DraftSettings
  set: (updater: Partial<NotesStoreData> | ((previousState: NotesStoreData) => NotesStoreData)) => void
  update: <K extends keyof NotesStoreData>(key: K, value: NotesStoreData[K]) => void
  updateConfig: (updates: Partial<AppConfig>) => void
  setNotes: (notes: Note[]) => void
  setFolders: (folders: Folder[]) => void
  setCurrentNote: (note: Note | null) => void
  setActiveNoteId: (noteId: string | null) => void
  hydrateFromLegacy: (legacyState: Partial<NotesStoreData>) => void
  resetSession: () => void
}

const baseInitialState: NotesStoreData = {
  user: null,
  notes: [],
  folders: [],
  view: "notes",
  activeFolderId: null,
  activeNoteId: null,
  searchQuery: "",
  currentNote: null,
  tempRating: 0,
  config: {
    lang: "ru",
    folderViewMode: "compact",
    reduceMotion: false,
    editorTools: {},
    interface: {
      showSavedFilters: true,
      showTagFilter: true,
      showUpdatedPeriodFilter: true
    },
    notesFilter: {
      sort: "manual",
      folders: [],
      tags: [],
      updatedWindowDays: 0
    }
  },
  recording: false,
  mediaRecorder: null,
  editorDirty: false,
  isEditing: false,
  isTyping: false,
  orderHistory: [],
  appearanceDraft: null,
  originalUserSettings: null,
  draftUserSettings: null,
  saveStatus: {
    status: "idle",
    message: "",
    updatedAt: 0
  },
  adminAnalysisStatus: {
    status: "idle",
    message: "",
    updatedAt: 0,
    processed: null,
    provider: "",
    uid: "",
    processedUsers: null
  },
  pagination: {
    displayLimit: 20,
    renderStep: 20,
    pageSize: 500,
    hasMoreOwnedNotes: false,
    loadingMoreOwnedNotes: false,
    lastOwnedNoteDocument: null,
    totalVisibleNotesCount: 0,
    renderedVisibleNotesCount: 0,
    searchActive: false
  }
}

const cloneState = <T,>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value)
  }

  return JSON.parse(JSON.stringify(value)) as T
}

export const getInitialNotesStoreState = (): NotesStoreData => cloneState(baseInitialState)

const mergeConfig = (baseConfig: AppConfig, nextConfig?: Partial<AppConfig>): AppConfig => ({
  ...baseConfig,
  ...(nextConfig || {}),
  interface: {
    ...baseConfig.interface,
    ...(nextConfig?.interface || {})
  },
  notesFilter: {
    ...baseConfig.notesFilter,
    ...(nextConfig?.notesFilter || {})
  },
  editorTools: {
    ...baseConfig.editorTools,
    ...((nextConfig?.editorTools as Record<string, boolean> | undefined) || {})
  }
})

const mergeState = (baseState: NotesStoreData, nextState?: Partial<NotesStoreData>): NotesStoreData => {
  const mergedCurrentNote = nextState?.currentNote === undefined
    ? baseState.currentNote
    : nextState.currentNote
  const mergedActiveNoteId = nextState?.activeNoteId === undefined
    ? (mergedCurrentNote?.id || baseState.activeNoteId || null)
    : nextState.activeNoteId

  return {
    ...baseState,
    ...(nextState || {}),
    activeNoteId: mergedActiveNoteId,
    currentNote: mergedCurrentNote,
    config: mergeConfig(baseState.config, nextState?.config),
    saveStatus: {
      ...baseState.saveStatus,
      ...(nextState?.saveStatus || {})
    },
    adminAnalysisStatus: {
      ...baseState.adminAnalysisStatus,
      ...(nextState?.adminAnalysisStatus || {})
    },
    pagination: {
      ...baseState.pagination,
      ...(nextState?.pagination || {})
    }
  }
}

const buildDraftSettings = (state: NotesStoreData): DraftSettings => ({
  appearanceDraft: state.appearanceDraft,
  originalUserSettings: state.originalUserSettings,
  draftUserSettings: state.draftUserSettings,
  editorDirty: state.editorDirty,
  isEditing: state.isEditing,
  isTyping: state.isTyping,
  tempRating: state.tempRating
})

const withDerivedFields = (state: NotesStoreData): NotesStoreData & { draftSettings: DraftSettings } => ({
  ...state,
  draftSettings: buildDraftSettings(state)
})

const persistStorage = createJSONStorage(() => localStorage)

export const useNotesStore = create<NotesStoreState>()(
  persist(
    (set, get) => ({
      ...withDerivedFields(getInitialNotesStoreState()),
      set: (updater) => {
        set((previousStoreState) => {
          const previousDataState = previousStoreState as NotesStoreData
          const nextDataState = typeof updater === "function"
            ? updater(previousDataState)
            : mergeState(previousDataState, updater)
          return withDerivedFields(nextDataState)
        })
      },
      update: (key, value) => {
        const currentState = get() as NotesStoreData
        const nextDataState = mergeState(currentState, { [key]: value } as Partial<NotesStoreData>)
        set(withDerivedFields(nextDataState))
      },
      updateConfig: (updates) => {
        const currentState = get() as NotesStoreData
        const nextDataState = mergeState(currentState, { config: mergeConfig(currentState.config, updates) })
        set(withDerivedFields(nextDataState))
      },
      setNotes: (notes) => {
        const currentState = get() as NotesStoreData
        const normalizedNotes = Array.isArray(notes) ? notes : []
        const nextCurrentNote = currentState.currentNote
          ? normalizedNotes.find((note) => String(note?.id || "") === String(currentState.currentNote?.id || "")) || currentState.currentNote
          : null
        const nextDataState = mergeState(currentState, { notes: normalizedNotes, currentNote: nextCurrentNote })
        set(withDerivedFields(nextDataState))
      },
      setFolders: (folders) => {
        const currentState = get() as NotesStoreData
        const nextDataState = mergeState(currentState, { folders: Array.isArray(folders) ? folders : [] })
        set(withDerivedFields(nextDataState))
      },
      setCurrentNote: (note) => {
        const currentState = get() as NotesStoreData
        const nextDataState = mergeState(currentState, {
          currentNote: note,
          activeNoteId: note?.id || null
        })
        set(withDerivedFields(nextDataState))
      },
      setActiveNoteId: (noteId) => {
        const currentState = get() as NotesStoreData
        const normalizedNoteId = noteId ? String(noteId) : null
        const resolvedCurrentNote = normalizedNoteId
          ? currentState.notes.find((note) => String(note?.id || "") === normalizedNoteId) || currentState.currentNote
          : null
        const nextDataState = mergeState(currentState, {
          activeNoteId: normalizedNoteId,
          currentNote: resolvedCurrentNote
        })
        set(withDerivedFields(nextDataState))
      },
      hydrateFromLegacy: (legacyState) => {
        const currentState = get() as NotesStoreData
        const nextDataState = mergeState(currentState, legacyState)
        set(withDerivedFields(nextDataState))
      },
      resetSession: () => {
        const currentState = get() as NotesStoreData
        const nextInitialState = getInitialNotesStoreState()
        const nextDataState = mergeState(nextInitialState, {
          config: currentState.config,
          pagination: {
            ...nextInitialState.pagination,
            renderStep: currentState.pagination.renderStep,
            pageSize: currentState.pagination.pageSize
          }
        })
        set(withDerivedFields(nextDataState))
      }
    }),
    {
      name: "smartnotes-zustand-store",
      storage: persistStorage,
      partialize: (state) => ({
        view: state.view,
        activeFolderId: state.activeFolderId,
        activeNoteId: state.activeNoteId,
        searchQuery: state.searchQuery,
        currentNote: state.currentNote,
        tempRating: state.tempRating,
        config: state.config,
        appearanceDraft: state.appearanceDraft,
        originalUserSettings: state.originalUserSettings,
        draftUserSettings: state.draftUserSettings,
        editorDirty: state.editorDirty,
        isEditing: state.isEditing,
        isTyping: state.isTyping
      }),
      merge: (persistedState, currentState) => {
        const currentDataState = currentState as NotesStoreData
        const persistedDataState = (persistedState || {}) as Partial<NotesStoreData>
        return {
          ...currentState,
          ...withDerivedFields(mergeState(currentDataState, persistedDataState))
        }
      }
    }
  )
)

declare global {
  interface Window {
    useNotesStore?: typeof useNotesStore
  }
}

if (typeof window !== "undefined") {
  window.useNotesStore = useNotesStore
}
