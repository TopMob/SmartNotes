'use client'

export default function Sidebar() {
  return (
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
  )
}
