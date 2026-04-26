'use client'

import type { CSSProperties } from "react"

const mediaDeleteStyle: CSSProperties = { color: "var(--danger)" }

export default function GlobalModals() {
  return (
    <>
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
    </>
  )
}
