'use client'

import { useEffect, useRef, useState, type CSSProperties } from "react"

declare global {
  interface Window {
    initApp?: () => void | Promise<void>
    __smartnotesRuntimeStarted?: boolean
  }
}

const filterActionsStyle: CSSProperties = { marginTop: "10px", gap: "8px", flexWrap: "wrap" }
const swatchBlackStyle = { "--swatch-color": "#111111" } as CSSProperties
const swatchBlueStyle = { "--swatch-color": "#2563eb" } as CSSProperties
const swatchGreenStyle = { "--swatch-color": "#16a34a" } as CSSProperties
const swatchOrangeStyle = { "--swatch-color": "#f97316" } as CSSProperties
const swatchRedStyle = { "--swatch-color": "#dc2626" } as CSSProperties
const mediaDeleteStyle: CSSProperties = { color: "var(--danger)" }
const canvasStyle: CSSProperties = { touchAction: "none" }
const hiddenFileInputStyle: CSSProperties = { display: "none" }

export default function HomePage() {
  const initCalledRef = useRef(false)
  const [isAppLoaded, setIsAppLoaded] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    if (initCalledRef.current) return
    initCalledRef.current = true

    const handleAuthChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ isAuthenticated?: boolean }>
      setIsAuthenticated(!!customEvent.detail?.isAuthenticated)
      setIsAppLoaded(true)
    }

    window.addEventListener("smartnotes-auth-changed", handleAuthChanged)

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
      {isAppLoaded && !isAuthenticated && (
      <div id="login-screen" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Авторизация" data-lang-aria="login_aria" data-modal-static="true">
        <div className="login-box">
          <h1 className="brand-text-fixed" data-brand-text="">SmartNotes</h1>
          <p className="subtext" data-lang="login">Вход в систему</p>
          <div className="auth-panel-switch" role="tablist" aria-label="Email authentication" data-lang-aria="email_authentication" inert={true} aria-busy="true">
            <button type="button" className="btn-auth-tab active" id="email-signin-tab" data-auth-mode="signin" data-lang="email_signin_tab">Вход</button>
            <button type="button" className="btn-auth-tab" id="email-signup-tab" data-auth-mode="signup" data-lang="email_signup_tab">Регистрация</button>
          </div>
          <form id="email-signin-form" className="auth-form" method="post" action="#" noValidate inert={true} aria-busy="true">
            <label className="auth-field" htmlFor="email-signin-input">
              <span data-lang="email_label">Email</span>
              <input id="email-signin-input" type="email" autoComplete="email" required />
            </label>
            <label className="auth-field" htmlFor="password-signin-input">
              <span data-lang="password_label">Пароль</span>
              <div className="auth-password-row">
                <input id="password-signin-input" type="password" autoComplete="current-password" required />
                <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signin-input" data-lang="show_password">Показать</button>
              </div>
            </label>
            <button type="button" className="btn-auth-link" data-auth-action="forgot-password" data-lang="forgot_password">Забыли пароль?</button>
            <button type="submit" className="btn-auth primary" data-lang="email_signin_button">Войти по email</button>
          </form>
          <form id="email-signup-form" className="auth-form hidden" method="post" action="#" noValidate inert={true} aria-busy="true">
            <label className="auth-field" htmlFor="email-signup-input">
              <span data-lang="email_label">Email</span>
              <input id="email-signup-input" type="email" autoComplete="email" required />
            </label>
            <label className="auth-field" htmlFor="password-signup-input">
              <span data-lang="password_label">Пароль</span>
              <div className="auth-password-row">
                <input id="password-signup-input" type="password" autoComplete="new-password" required />
                <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signup-input" data-lang="show_password">Показать</button>
              </div>
            </label>
            <label className="auth-field" htmlFor="password-signup-repeat-input">
              <span data-lang="password_repeat_label">Повторите пароль</span>
              <div className="auth-password-row">
                <input id="password-signup-repeat-input" type="password" autoComplete="new-password" required />
                <button type="button" className="btn-auth-toggle-password" data-toggle-target="password-signup-repeat-input" data-lang="show_password">Показать</button>
              </div>
            </label>
            <button type="submit" className="btn-auth primary" data-lang="email_signup_button">Зарегистрироваться</button>
          </form>
          <div id="email-auth-feedback" className="auth-feedback is-info" role="status" aria-live="polite">Подключение к сервису входа...</div>
          <div className="auth-buttons-group">
            <button type="button" className="btn-auth google" data-action="login">
              <img src="css/Glogo.svg" alt="" width="20" height="20" />
              <span data-lang="login_google">Войти через Google</span>
            </button>
          </div>
        </div>
      </div>
      )}
      {isAppLoaded && isAuthenticated && (
        <div id="app" className="app-layout" aria-hidden="false">
          <aside id="sidebar" className="sidebar-glass" aria-label="Навигация" data-lang-aria="nav_aria">
          <header className="sidebar-header">
            <span className="brand-text-fixed" data-brand-text="">SmartNotes</span>
            <button type="button" className="btn-icon mobile-only" data-action="toggle-sidebar" data-force="false" aria-label="Закрыть меню" data-lang-aria="close_menu">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <nav className="sidebar-nav scrollable" aria-label="Разделы" data-lang-aria="sections_aria">
            <div className="nav-group">
              <button type="button" className="nav-item active" data-action="switch-view" data-view="notes">
                <i className="material-icons-round" aria-hidden="true">description</i>
                <span data-lang="all_notes">Все записи</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="favorites">
                <i className="material-icons-round" aria-hidden="true">star</i>
                <span data-lang="favorites">Важное</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="archive">
                <i className="material-icons-round" aria-hidden="true">archive</i>
                <span data-lang="archive">Архив</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="reminders">
                <i className="material-icons-round" aria-hidden="true">schedule</i>
                <span data-lang="reminder_notes">Напоминания</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="trash">
                <i className="material-icons-round" aria-hidden="true">delete</i>
                <span data-lang="trash">Корзина</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="folders">
                <i className="material-icons-round" aria-hidden="true">folder</i>
                <span data-lang="folders_overview">Папки</span>
              </button>
              <button type="button" className="nav-item" data-action="create-folder">
                <i className="material-icons-round" aria-hidden="true">create_new_folder</i>
                <span data-lang="create_folder">Создать папку</span>
              </button>
            </div>
            <div className="nav-group">
              <div className="nav-title" data-lang="folders">ПАПКИ</div>
              <div id="folder-list-root" className="folder-list-root"></div>
            </div>
            <div className="nav-group" id="pending-invites-group">
              <div className="nav-title" data-lang="pending_invites_title">ПРИГЛАШЕНИЯ</div>
              <div id="pending-invites-root" className="pending-invites-root"></div>
            </div>
            <div className="nav-group">
              <div className="nav-title" data-lang="smart_features">УМНЫЕ ФУНКЦИИ</div>
              <button type="button" className="nav-item" data-action="switch-view" data-view="locked">
                <i className="material-icons-round" aria-hidden="true">lock</i>
                <span data-lang="lock_center">Защита заметок</span>
              </button>
              <button type="button" className="nav-item" data-action="switch-view" data-view="hidden_folders">
                <i className="material-icons-round" aria-hidden="true">visibility_off</i>
                <span data-lang="hidden_folders">Скрытые папки</span>
              </button>
              <button type="button" id="admin-tools-nav-button" className="nav-item hidden" data-action="switch-view" data-view="admin_tools">
                <i className="material-icons-round" aria-hidden="true">admin_panel_settings</i>
                <span data-lang="admin_tools">Админ-меню</span>
              </button>
            </div>
          </nav>
          <footer className="sidebar-footer">
            <button type="button" className="footer-link" data-action="open-modal" data-modal="feedback-menu-modal">
              <i className="material-icons-round" aria-hidden="true">info</i>
              <span data-lang="about_menu">О приложении</span>
            </button>
            <button type="button" className="footer-link" data-action="open-settings">
              <i className="material-icons-round" aria-hidden="true">settings</i>
              <span data-lang="settings">Настройки</span>
            </button>
          </footer>
        </aside>
        <div id="sidebar-overlay" className="sidebar-overlay" aria-hidden="true"></div>
        <main className="main-content">
          <header className="top-bar" role="banner">
            <div className="header-left">
              <button type="button" id="menu-toggle" className="btn-icon" data-action="toggle-sidebar" aria-label="Открыть меню" data-lang-aria="open_menu">
                <i className="material-icons-round" aria-hidden="true">menu</i>
              </button>
              <div className="view-title-group">
                <h2 id="current-view-title" className="mobile-only-title">SmartNotes</h2>
                <div id="active-folder-menu-wrapper" className="active-folder-menu-wrapper hidden">
                  <button type="button" id="active-folder-menu-toggle" className="btn-icon" data-action="toggle-active-folder-menu" aria-label="Действия с папкой" data-lang-aria="folder_actions">
                    <i className="material-icons-round" aria-hidden="true">more_vert</i>
                  </button>
                  <div id="active-folder-menu" className="dropdown-menu active-folder-menu" role="menu" aria-label="Действия с папкой" data-lang-aria="folder_actions">
                    <button type="button" id="active-folder-share-button" className="dropdown-item" data-action="share-active-folder">
                      <i className="material-icons-round" aria-hidden="true">person_add</i>
                      <span data-lang="share_folder">Поделиться папкой</span>
                    </button>
                    <button type="button" className="dropdown-item" data-action="share-active-folder-link">
                      <i className="material-icons-round" aria-hidden="true">link</i>
                      <span data-lang="share_copy_link">Скопировать ссылку</span>
                    </button>
                    <button type="button" className="dropdown-item" data-action="rename-active-folder">
                      <i className="material-icons-round" aria-hidden="true">edit</i>
                      <span data-lang="rename_folder">Переименовать папку</span>
                    </button>
                    <button type="button" id="active-folder-hide-button" className="dropdown-item" data-action="toggle-active-folder-hidden">
                      <i className="material-icons-round" aria-hidden="true">visibility_off</i>
                      <span data-lang="hide_folder">Скрыть папку</span>
                    </button>
                    <button type="button" className="dropdown-item danger" data-action="delete-active-folder">
                      <i className="material-icons-round" aria-hidden="true">delete</i>
                      <span data-lang="delete_folder">Удалить папку</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div className="search-container" role="search">
              <i className="material-icons-round search-icon" aria-hidden="true">search</i>
              <input type="text" id="search-input" placeholder="Поиск..." data-lang-placeholder="search" autoComplete="off" aria-label="Поиск заметок" data-lang-aria="search_aria" />
            </div>
            <div className="header-right">
              <button type="button" id="clear-trash-button" className="btn-icon hidden" data-action="clear-trash" aria-label="Очистить корзину" data-lang-aria="clear_trash">
                <i className="material-icons-round" aria-hidden="true">delete_sweep</i>
              </button>
              <button type="button" id="notes-filter-toggle" className="btn-icon" data-action="toggle-filter-menu" aria-label="Фильтры" data-lang-aria="filters">
                <i className="material-icons-round" aria-hidden="true">filter_alt</i>
              </button>
              <div className="user-avatar-wrapper">
                <img id="user-photo" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="User" className="header-avatar" data-action="toggle-user-menu" />
                <div id="user-dropdown" className="dropdown-menu" role="menu" aria-label="Пользователь" data-lang-aria="user_menu">
                  <div className="dropdown-header user-profile-header">
                    <div className="user-name-row">
                      <span id="user-name">.</span>
                      <button type="button" className="btn-icon" data-action="edit-display-name" aria-label="Изменить имя" data-lang-aria="edit_display_name">
                        <i className="material-icons-round" aria-hidden="true">edit</i>
                      </button>
                    </div>
                    <button type="button" className="user-uid-row" data-action="copy-user-uid" aria-label="UID пользователя" data-lang-aria="copy_uid_row">
                      <span data-lang="user_uid_label">UID пользователя</span>
                      <span id="user-uid" className="user-uid-label">-</span>
                      <i className="material-icons-round" aria-hidden="true">content_copy</i>
                    </button>
                    <div className="row-left">
                      <button type="button" className="btn-secondary" data-action="change-avatar" data-lang="change_avatar">Изменить фото</button>
                    </div>
                  </div>
                  <button type="button" className="dropdown-item danger" data-action="logout">
                    <i className="material-icons-round" aria-hidden="true">logout</i>
                    <span data-lang="logout">Выйти</span>
                  </button>
                </div>
              </div>
            </div>
          </header>
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
      <div id="note-editor" className="editor-overlay" role="dialog" aria-modal="true" aria-label="Редактор" data-lang-aria="editor">
        <div className="editor-container">
          <header className="editor-header-bar">
            <button type="button" className="btn-icon" data-action="close-editor" aria-label="Назад" data-lang-aria="back">
              <i className="material-icons-round" aria-hidden="true">arrow_back</i>
            </button>
            <div className="editor-tools" aria-label="Действия редактора" data-lang-aria="editor_actions">
              <div className="editor-page-controls editor-page-controls-header" aria-label="Страницы" data-lang-aria="editor_pages">
                <button type="button" className="btn-icon" data-action="editor-prev-page" aria-label="Предыдущая страница" data-lang-aria="page_prev">
                  <i className="material-icons-round" aria-hidden="true">chevron_left</i>
                </button>
                <span id="editor-page-indicator" className="page-indicator" aria-live="polite">1/1</span>
                <button type="button" className="btn-icon" data-action="editor-next-page" aria-label="Следующая страница" data-lang-aria="page_next">
                  <i className="material-icons-round" aria-hidden="true">chevron_right</i>
                </button>
                <button type="button" className="btn-icon" data-action="open-modal" data-modal="editor-pages-modal" aria-label="Управление страницами" data-lang-aria="editor_pages_manage">
                  <i className="material-icons-round" aria-hidden="true">menu_book</i>
                </button>
              </div>
              <div className="divider-vertical" aria-hidden="true"></div>
              <button type="button" className="btn-icon" data-action="editor-undo" aria-label="Отменить" data-lang-aria="undo">
                <i className="material-icons-round" aria-hidden="true">undo</i>
              </button>
              <button type="button" className="btn-icon" data-action="editor-redo" aria-label="Повторить" data-lang-aria="redo">
                <i className="material-icons-round" aria-hidden="true">redo</i>
              </button>
              <button type="button" className="btn-secondary editor-share-button hidden" data-action="share-note">Share</button>
              <button type="button" className="btn-icon hidden" data-action="share-note-link" aria-label="Скопировать ссылку" data-lang-aria="share_copy_link">
                <i className="material-icons-round" aria-hidden="true">link</i>
              </button>
              <div className="editor-access-badge hidden" data-role="editor-access-badge"></div>
              <div className="editor-collaborators hidden" data-role="editor-collaborators" aria-label="Collaborators"></div>
              <div className="divider-vertical" aria-hidden="true"></div>
              <button type="button" className="btn-icon" data-action="editor-note-actions" aria-label="Действия с заметкой" data-lang-aria="folder_actions">
                <i className="material-icons-round" aria-hidden="true">more_vert</i>
              </button>
              <button type="button" className="btn-icon" id="toolbar-toggle" data-action="toggle-toolbar" aria-label="Скрыть панель инструментов" data-lang-aria="toolbar_hide">
                <i className="material-icons-round" aria-hidden="true">expand_less</i>
              </button>
            </div>
          </header>
          <div className="editor-scroll-area scrollable">
            <input id="note-title" type="text" placeholder="Без названия" data-lang-placeholder="note_title" aria-label="Заголовок заметки" data-lang-aria="note_title_aria" />
            <div id="editor-toolbar" className="editor-toolbar" role="toolbar" aria-label="Инструменты редактора" data-lang-aria="editor_toolbar"></div>
            <div id="drawing-controls" className="drawing-controls hidden" aria-label="Настройки рисования" data-lang-aria="drawing_settings">
              <div className="drawing-tool-group" role="group" aria-label="Инструменты рисования" data-lang-aria="drawing_tools">
                <button type="button" className="drawing-tool-btn is-active" data-drawing-tool="pen" data-lang="drawing_tool_pen">Перо</button>
                <button type="button" className="drawing-tool-btn" data-drawing-tool="eraser" data-lang="drawing_tool_eraser">Ластик</button>
              </div>
              <label className="drawing-control">
                <span className="drawing-control-label" data-lang="drawing_color">Цвет</span>
                <div className="color-picker" data-color-picker="">
                  <input id="drawing-color" type="text" className="color-picker-input" data-color-input="" defaultValue="#111111" aria-label="Цвет" data-lang-aria="drawing_color" autoComplete="off" />
                  <button type="button" className="color-picker-trigger" data-color-trigger="" aria-label="Цвет" data-lang-aria="drawing_color">
                    <span className="color-picker-swatch" data-color-swatch=""></span>
                    <span className="color-picker-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" focusable="false">
                        <path d="M12 3c4.97 0 9 3.13 9 7 0 2.2-1.42 4.19-3.71 5.48-.79.44-1.28 1.28-1.28 2.18v.84c0 .83-.67 1.5-1.5 1.5h-2.5c-.83 0-1.5-.67-1.5-1.5v-1.3H9c-3.87 0-7-2.69-7-6s3.13-7 10-7zm-4 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                      </svg>
                    </span>
                  </button>
                  <div className="color-picker-panel" data-color-panel="" role="dialog" aria-label="Палитра" data-lang-aria="drawing_presets">
                    <div className="color-picker-sv" data-color-sv="">
                      <span className="color-picker-sv-handle" data-color-sv-handle=""></span>
                    </div>
                    <div className="color-picker-hue" data-color-hue="">
                      <span className="color-picker-hue-handle" data-color-hue-handle=""></span>
                    </div>
                    <div className="color-picker-hex-row">
                      <span className="color-picker-hex-label">#</span>
                      <input type="text" className="color-picker-hex" data-color-hex="" maxLength={7} aria-label="HEX" data-lang-aria="hex_color" autoComplete="off" />
                    </div>
                  </div>
                </div>
              </label>
              <div className="drawing-color-presets" role="group" aria-label="Палитра" data-lang-aria="drawing_presets">
                <button type="button" className="drawing-color-swatch is-active" data-drawing-color="#111111" style={swatchBlackStyle} aria-label="Черный" data-lang-aria="color_black"></button>
                <button type="button" className="drawing-color-swatch" data-drawing-color="#2563eb" style={swatchBlueStyle} aria-label="Синий" data-lang-aria="color_blue"></button>
                <button type="button" className="drawing-color-swatch" data-drawing-color="#16a34a" style={swatchGreenStyle} aria-label="Зеленый" data-lang-aria="color_green"></button>
                <button type="button" className="drawing-color-swatch" data-drawing-color="#f97316" style={swatchOrangeStyle} aria-label="Оранжевый" data-lang-aria="color_orange"></button>
                <button type="button" className="drawing-color-swatch" data-drawing-color="#dc2626" style={swatchRedStyle} aria-label="Красный" data-lang-aria="color_red"></button>
              </div>
              <label className="drawing-control">
                <span className="drawing-control-label" data-lang="drawing_size">Размер</span>
                <input id="drawing-size" type="range" className="drawing-range" min="1" max="16" defaultValue="3" aria-label="Размер" data-lang-aria="drawing_size" />
              </label>
            </div>
            <div className="note-content-wrapper">
              <div id="note-content-editable" className="note-content" role="group" aria-label="Текст заметки" data-lang-aria="note_body_aria"></div>
            </div>
          </div>
          <div className="editor-bottom-panel">
            <div className="tags-row" aria-label="Теги" data-lang-aria="tags_aria">
              <input id="note-tags-input" type="text" placeholder="#тег (Enter)" data-lang-placeholder="note_tags" aria-label="Добавить тег" data-lang-aria="note_tags_aria" autoComplete="off" />
              <div id="note-tags-container" className="tags-container" aria-live="polite"></div>
            </div>
            <div className="editor-bottom-actions">
              <button type="button" className="btn-primary" data-action="editor-save" aria-label="Сохранить" data-lang-aria="save_note">
                <i className="material-icons-round" aria-hidden="true">save</i>
                <span data-lang="save">Сохранить</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="editor-pages-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Управление страницами" data-lang-aria="editor_pages_manage">
        <div className="modal-card">
          <div className="modal-header">
            <h2 data-lang="editor_pages">Страницы</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="editor-pages-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </div>
          <div className="modal-body editor-pages-modal-body">
            <div id="editor-pages-list" className="editor-pages-list"></div>
            <div className="editor-pages-add-row">
              <button type="button" className="btn-primary" data-action="editor-add-page" aria-label="Добавить страницу" data-lang-aria="page_add">
                <i className="material-icons-round" aria-hidden="true">note_add</i>
                <span data-lang="page_add">Добавить страницу</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <div id="media-context-menu" className="media-context-menu hidden" role="menu" aria-label="Меню изображения" data-lang-aria="media_menu">
        <button type="button" className="btn-icon" data-action="media-reset" aria-label="Сбросить размер" data-lang-aria="reset_media">
          <i className="material-icons-round" aria-hidden="true">aspect_ratio</i>
        </button>
        <button type="button" className="btn-icon" data-action="media-align" data-align="left" aria-label="По левому краю" data-lang-aria="align_left">
          <i className="material-icons-round" aria-hidden="true">format_align_left</i>
        </button>
        <button type="button" className="btn-icon" data-action="media-align" data-align="right" aria-label="По правому краю" data-lang-aria="align_right">
          <i className="material-icons-round" aria-hidden="true">format_align_right</i>
        </button>
        <button type="button" className="btn-icon" data-action="media-delete" style={mediaDeleteStyle} aria-label="Удалить" data-lang-aria="delete">
          <i className="material-icons-round" aria-hidden="true">delete</i>
        </button>
      </div>
      <div id="editor-align-menu" className="context-menu hidden" role="menu" aria-label="Выравнивание" data-lang-aria="align_menu">
        <button type="button" data-action="editor-align" data-align="left" aria-label="По левому краю" data-lang-aria="align_left">
          <i className="material-icons-round" aria-hidden="true">format_align_left</i>
        </button>
        <button type="button" data-action="editor-align" data-align="center" aria-label="По центру" data-lang-aria="align_center">
          <i className="material-icons-round" aria-hidden="true">format_align_center</i>
        </button>
        <button type="button" data-action="editor-align" data-align="right" aria-label="По правому краю" data-lang-aria="align_right">
          <i className="material-icons-round" aria-hidden="true">format_align_right</i>
        </button>
      </div>
      <div id="confirm-modal" className="modal-overlay confirm-layer" role="dialog" aria-modal="true">
        <div className="confirm-box">
          <h3 id="confirm-title" data-lang="confirm_default">Подтвердите</h3>
          <div className="row-center">
            <button type="button" className="btn-secondary" id="confirm-cancel" data-lang="cancel">Отмена</button>
            <button type="button" className="btn-danger" id="confirm-ok" data-lang="yes">Да</button>
          </div>
        </div>
      </div>
      <div id="prompt-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card confirm-box">
          <h3 id="prompt-title" data-lang="prompt_title">Ввод</h3>
          <input type="text" id="prompt-input" className="input-area prompt-input" autoComplete="off" aria-label="Поле ввода" data-lang-aria="prompt_input" />
          <div id="prompt-secondary-field" className="prompt-secondary-field hidden">
            <textarea id="prompt-secondary-input" className="input-area prompt-secondary-input" rows={4} aria-label="Описание папки" data-lang-aria="folder_description_prompt"></textarea>
            <select id="prompt-secondary-select" className="input-area prompt-secondary-input hidden" aria-label="Дополнительное поле"></select>
          </div>
          <div className="row-center">
            <button type="button" className="btn-secondary" id="prompt-cancel" data-lang="cancel">Отмена</button>
            <button type="button" className="btn-primary" id="prompt-ok" data-lang="ok">ОК</button>
          </div>
        </div>
      </div>
      <div id="note-actions-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="note_actions">Действия</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="note-actions-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body" id="note-actions-content"></div>
        </div>
      </div>
      <div id="lock-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Блокировка заметки" data-lang-aria="lock_note">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="lock_title">Блокировка</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="lock-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body">
            <input id="lock-password" type="password" className="input-area" placeholder="Пароль" data-lang-placeholder="lock_password" autoComplete="new-password" autoCapitalize="off" autoCorrect="off" spellCheck={false} data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
            <div className="row-right">
              <button type="button" className="btn-secondary" data-action="close-modal" data-modal="lock-modal" data-lang="cancel">Отмена</button>
              <button type="button" className="btn-primary" id="lock-apply" data-lang="apply">Применить</button>
            </div>
          </div>
        </div>
      </div>
      <div id="lock-center-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Центр защиты" data-lang-aria="lock_center">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="lock_center">Защита заметок</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="lock-center-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body">
            <p className="muted" data-lang="lock_center_desc">Тут будут фильтры скрытых заметок и быстрые действия</p>
            <div id="lock-center-empty" className="empty-placeholder hidden">
              <i className="material-icons-round" aria-hidden="true">lock_open</i>
              <p data-lang="lock_center_empty">Нет защищенных заметок</p>
            </div>
            <div id="lock-center-list" className="lock-center-list"></div>
            <div className="modal-actions-grid">
              <button type="button" className="btn-secondary" data-action="close-modal" data-modal="lock-center-modal" data-lang="close">Закрыть</button>
            </div>
          </div>
        </div>
      </div>
      <div id="photo-editor-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card full-screen-modal">
          <header className="modal-header modal-header-tight">
            <div className="row-left">
              <h2 className="modal-title" data-lang="photo_editor">Редактор фото</h2>
              <div className="color-picker" data-color-picker="">
                <input type="text" id="photo-color-picker" defaultValue="#00f2ff" className="color-picker-input" data-color-input="" aria-label="Цвет кисти" data-lang-aria="photo_color" autoComplete="off" />
                <button type="button" className="color-picker-trigger" data-color-trigger="" aria-label="Цвет кисти" data-lang-aria="photo_color">
                  <span className="color-picker-swatch" data-color-swatch=""></span>
                  <span className="color-picker-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" focusable="false">
                      <path d="M12 3c4.97 0 9 3.13 9 7 0 2.2-1.42 4.19-3.71 5.48-.79.44-1.28 1.28-1.28 2.18v.84c0 .83-.67 1.5-1.5 1.5h-2.5c-.83 0-1.5-.67-1.5-1.5v-1.3H9c-3.87 0-7-2.69-7-6s3.13-7 10-7zm-4 6a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm7-2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm2 5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z" />
                    </svg>
                  </span>
                </button>
                <div className="color-picker-panel" data-color-panel="" role="dialog" aria-label="Палитра" data-lang-aria="drawing_presets">
                  <div className="color-picker-sv" data-color-sv="">
                    <span className="color-picker-sv-handle" data-color-sv-handle=""></span>
                  </div>
                  <div className="color-picker-hue" data-color-hue="">
                    <span className="color-picker-hue-handle" data-color-hue-handle=""></span>
                  </div>
                  <div className="color-picker-hex-row">
                    <span className="color-picker-hex-label">#</span>
                    <input type="text" className="color-picker-hex" data-color-hex="" maxLength={7} aria-label="HEX" data-lang-aria="hex_color" autoComplete="off" />
                  </div>
                </div>
              </div>
              <input type="range" id="photo-width-picker" min="1" max="20" defaultValue="3" className="range-compact" aria-label="Толщина кисти" data-lang-aria="photo_width" />
            </div>
            <div className="row-right">
              <button type="button" className="btn-icon" data-action="photo-undo" aria-label="Отменить" data-lang-aria="undo"><i className="material-icons-round" aria-hidden="true">undo</i></button>
              <button type="button" className="btn-icon" data-action="photo-clear" aria-label="Очистить" data-lang-aria="clear"><i className="material-icons-round" aria-hidden="true">delete</i></button>
              <button type="button" className="btn-icon" data-action="close-modal" data-modal="photo-editor-modal" aria-label="Закрыть" data-lang-aria="close"><i className="material-icons-round" aria-hidden="true">close</i></button>
            </div>
          </header>
          <div className="modal-body no-padding modal-canvas-body">
            <canvas id="photo-editor-canvas" className="canvas-full" style={canvasStyle}></canvas>
          </div>
          <footer className="modal-footer">
            <button type="button" className="btn-primary" data-action="photo-save" data-lang="save">Сохранить</button>
          </footer>
        </div>
      </div>
      <div id="settings-modal" className="modal-overlay" role="dialog" aria-modal="true" aria-label="Настройки" data-lang-aria="settings">
        <div className="modal-card">
          <header className="modal-header">
            <button type="button" className="btn-icon settings-back" data-action="settings-back" aria-label="Назад" data-lang-aria="settings_back">
              <i className="material-icons-round" aria-hidden="true">arrow_back</i>
            </button>
            <h2 id="settings-title" data-lang="settings_menu_title">Настройки</h2>
            <button type="button" className="btn-icon" data-action="close-settings-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body" id="settings-content"></div>
        </div>
      </div>
      <div id="feedback-menu-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="about_menu">О приложении</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="feedback-menu-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body">
            <div className="modal-actions-grid">
              <button type="button" className="btn-secondary" data-action="open-feedback-modal" data-modal="about-modal" data-lang="about">О нас</button>
              <button type="button" className="btn-secondary" data-action="open-feedback-modal" data-modal="rate-modal" data-lang="rate">Оценить</button>
              <button type="button" className="btn-secondary" disabled data-lang="coming_future">В будущем</button>
            </div>
          </div>
        </div>
      </div>
      <div id="about-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="team">Команда</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="about-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body">
            <ul className="team-list">
              <li className="team-member name-alexandrov">Александров Арсений</li>
              <li className="team-member name-malyshev">Малышев Егор</li>
              <li className="team-member name-kopaev">Копаев Иван</li>
              <li className="team-member name-minyaev">Миняев Иван</li>
            </ul>
            <div className="bot-link-wrapper">
              <span className="bot-link-label" data-lang="contact_us">Связаться с нами:</span>
              <a href="https://t.me/SmartNotesInfo_bot" target="_blank" rel="noopener noreferrer" className="btn-primary telegram-btn">
                <i className="material-icons-round" aria-hidden="true">smart_toy</i>
                @SmartNotesInfo_bot
              </a>
            </div>
          </div>
        </div>
      </div>
      <div id="rate-modal" className="modal-overlay" role="dialog" aria-modal="true">
        <div className="modal-card">
          <header className="modal-header">
            <h2 data-lang="rate">Оценить</h2>
            <button type="button" className="btn-icon" data-action="close-modal" data-modal="rate-modal" aria-label="Закрыть" data-lang-aria="close">
              <i className="material-icons-round" aria-hidden="true">close</i>
            </button>
          </header>
          <div className="modal-body">
            <div className="stars-row" aria-label="Оценка" data-lang-aria="rating_aria">
              <i className="material-icons-round star" data-val="1">star_border</i>
              <i className="material-icons-round star" data-val="2">star_border</i>
              <i className="material-icons-round star" data-val="3">star_border</i>
              <i className="material-icons-round star" data-val="4">star_border</i>
              <i className="material-icons-round star" data-val="5">star_border</i>
            </div>
            <textarea id="feedback-text" placeholder="." data-lang-placeholder="feedback_placeholder" rows={4} className="input-area" aria-label="Ваш отзыв" data-lang-aria="feedback_aria"></textarea>
          </div>
          <footer className="modal-footer">
            <button type="button" className="btn-primary" data-action="submit-feedback" data-lang="send">Отправить</button>
          </footer>
        </div>
      </div>
      <div id="global-loading-overlay" className="global-loading-overlay hidden" aria-live="assertive" aria-busy="false">
        <div className="global-loading-card">
          <div className="global-loading-spinner" aria-hidden="true"></div>
          <span id="global-loading-text">Загрузка...</span>
        </div>
      </div>
      <div id="toast-container" className="toast-container" aria-live="polite"></div>
      <input type="file" id="img-upload" accept="image/*" style={hiddenFileInputStyle} aria-hidden="true" />
      <input type="file" id="avatar-upload-input" accept="image/*" style={hiddenFileInputStyle} aria-hidden="true" />
      <input type="file" id="note-import" accept=".json,application/json" style={hiddenFileInputStyle} aria-hidden="true" />
    </>
  )
}
