'use client'

import type { CSSProperties } from "react"

const filterActionsStyle: CSSProperties = { marginTop: "10px", gap: "8px", flexWrap: "wrap" }

export default function Header() {
  return (
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
  )
}
