'use client'

import LoginScreen from "./components/auth/LoginScreen"
import NoteEditor from "./components/editor/NoteEditor"
import Header from "./components/layout/Header"
import Sidebar from "./components/layout/Sidebar"
import GlobalModals from "./components/modals/GlobalModals"
import { useEffect, useRef, useState, type CSSProperties } from "react"

declare global {
  interface Window {
    initApp?: () => void | Promise<void>
    __smartnotesRuntimeStarted?: boolean
    SmartNotesAuthUi?: {
      ready?: boolean
    }
    StateStore?: {
      read?: () => {
        user?: {
          uid?: string
        } | null
      }
    }
  }
}

const filterActionsStyle: CSSProperties = { marginTop: "10px", gap: "8px", flexWrap: "wrap" }
const hiddenFileInputStyle: CSSProperties = { display: "none" }

export default function HomePage() {
  const initCalledRef = useRef(false)
  const [isAppLoaded, setIsAppLoaded] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (initCalledRef.current) return
    initCalledRef.current = true

    const resolveRuntimeState = () => {
      const stateUser = window.StateStore?.read?.()?.user
      const isReady = !!window.SmartNotesAuthUi?.ready
      const splashScreen = document.getElementById("splash-screen")
      const splashHidden = splashScreen?.classList.contains("hidden") || splashScreen?.style.display === "none"

      if (!isReady && !splashHidden) return false

      setIsAuthenticated(!!stateUser?.uid)
      setIsAppLoaded(true)
      return true
    }

    const handleAuthChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ isAuthenticated?: boolean }>
      setIsAuthenticated(!!customEvent.detail?.isAuthenticated)
      setIsAppLoaded(true)
    }

    window.addEventListener("smartnotes-auth-changed", handleAuthChanged)

    if (!resolveRuntimeState()) {
      const bootstrapInterval = window.setInterval(() => {
        if (!resolveRuntimeState()) return
        window.clearInterval(bootstrapInterval)
      }, 100)

      const bootstrapTimeout = window.setTimeout(() => {
        window.clearInterval(bootstrapInterval)
        resolveRuntimeState()
      }, 10000)

      return () => {
        window.clearInterval(bootstrapInterval)
        window.clearTimeout(bootstrapTimeout)
        window.removeEventListener("smartnotes-auth-changed", handleAuthChanged)
      }
    }

    return () => {
      window.removeEventListener("smartnotes-auth-changed", handleAuthChanged)
    }
  }, [])

  useEffect(() => {
    if (!isAppLoaded || !isAuthenticated || window.__smartnotesRuntimeStarted) return
    if (!window.initApp) return

    window.__smartnotesRuntimeStarted = true
    Promise.resolve(window.initApp()).catch(() => {
      window.__smartnotesRuntimeStarted = false
    })
  }, [isAppLoaded, isAuthenticated])

  return (
    <>
      <div className="bg-wrapper" aria-hidden="true"></div>
      {!isAppLoaded && (
        <div id="splash-screen" className="splash active" aria-live="polite">
          <h1>SmartNotes</h1>
          <p>AI-organized thinking</p>
          <div className="loader" aria-hidden="true"></div>
        </div>
      )}
      {isAppLoaded && !isAuthenticated && <LoginScreen />}
      {isAppLoaded && isAuthenticated && (
        <div id="app" className="app-layout" aria-hidden="false">
          <Sidebar />
          <div id="sidebar-overlay" className="sidebar-overlay" aria-hidden="true"></div>
          <main className="main-content">
            <Header />
            <div id="notes-filter-menu" className="dropdown-menu filter-menu" role="menu" aria-label="Фильтры" data-lang-aria="filters">
              <div className="filter-section" id="notes-filter-section-saved">
                <label htmlFor="notes-saved-filter-select" data-lang="saved_filters">Сохранённые фильтры</label>
                <select id="notes-saved-filter-select" className="input-area filter-select" aria-label="Сохранённые фильтры" data-lang-aria="saved_filters">
                  <option value="" data-lang="saved_filters_none">Без сохранённого фильтра</option>
                </select>
                <div className="row-left" style={filterActionsStyle}>
                  <button type="button" id="notes-save-filter-button" className="btn-secondary" data-lang="save_filter">Сохранить</button>
                  <button type="button" id="notes-delete-filter-button" className="btn-secondary" data-lang="delete_saved_filter">Удалить</button>
                </div>
              </div>
              <div className="filter-section" id="notes-filter-section-sort">
                <label htmlFor="notes-sort-select" data-lang="sort_by">Сортировка</label>
                <select id="notes-sort-select" className="input-area filter-select" aria-label="Сортировка" data-lang-aria="sort_by">
                  <option value="updated" data-lang="sort_updated">По времени изменения</option>
                  <option value="relevance" data-lang="sort_relevance">По релевантности</option>
                  <option value="importance" data-lang="sort_importance">По важности</option>
                  <option value="title" data-lang="sort_title">По алфавиту</option>
                  <option value="length" data-lang="sort_length">По количеству символов</option>
                  <option value="manual" data-lang="sort_manual">Вручную</option>
                </select>
              </div>
              <div className="filter-section" id="notes-filter-section-tags">
                <label htmlFor="notes-tag-filter-input" data-lang="filter_tags">Теги</label>
                <input type="text" id="notes-tag-filter-input" className="input-area filter-select" placeholder="design, work" data-lang-placeholder="filter_tags_placeholder" aria-label="Теги" data-lang-aria="filter_tags" />
              </div>
              <div className="filter-section" id="notes-filter-section-date">
                <label htmlFor="notes-date-filter-select" data-lang="filter_updated_period">Период обновления</label>
                <select id="notes-date-filter-select" className="input-area filter-select" aria-label="Период обновления" data-lang-aria="filter_updated_period">
                  <option value="0" data-lang="filter_updated_any">За всё время</option>
                  <option value="1" data-lang="filter_updated_day">За 24 часа</option>
                  <option value="7" data-lang="filter_updated_week">За 7 дней</option>
                  <option value="30" data-lang="filter_updated_month">За 30 дней</option>
                  <option value="365" data-lang="filter_updated_year">За год</option>
                </select>
              </div>
              <div className="filter-section" id="notes-filter-section-folders">
                <div className="filter-title" data-lang="filter_folders">Папки</div>
                <div id="notes-folder-filters" className="filter-options"></div>
              </div>
            </div>
            <section id="notes-content-area" className="content-scrollable scrollable" aria-label="Список заметок" data-lang-aria="notes_list_aria">
              <div id="app-loader" className="loader-container hidden" aria-hidden="true">
                <div className="spinner" aria-hidden="true"></div>
              </div>
              <div id="empty-state" className="empty-placeholder hidden" aria-live="polite">
                <i className="material-icons-round" aria-hidden="true">note_add</i>
                <p data-lang="empty">Здесь пока пусто</p>
              </div>
              <div id="notes-container" className="notes-grid" role="list"></div>
              <button type="button" id="load-more-notes-button" className="btn-secondary load-more-notes hidden" data-action="load-more-notes" data-lang="load_more_notes">Загрузить ещё</button>
            </section>
            <button type="button" className="btn-fab" data-action="primary-action" aria-label="Создать заметку" data-lang-aria="create_note">
              <i className="material-icons-round" aria-hidden="true">add</i>
            </button>
          </main>
        </div>
      )}
      <NoteEditor />
      <GlobalModals />
      <div id="toast-container" className="toast-container" aria-live="polite"></div>
      <input type="file" id="img-upload" accept="image/*" style={hiddenFileInputStyle} aria-hidden="true" />
      <input type="file" id="avatar-upload-input" accept="image/*" style={hiddenFileInputStyle} aria-hidden="true" />
      <input type="file" id="note-import" accept=".json,application/json" style={hiddenFileInputStyle} aria-hidden="true" />
    </>
  )
}
