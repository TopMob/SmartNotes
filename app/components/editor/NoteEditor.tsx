'use client'

import { useNotesStore } from "@/store/useNotesStore"
import type { CSSProperties } from "react"

const swatchBlackStyle = { "--swatch-color": "#111111" } as CSSProperties
const swatchBlueStyle = { "--swatch-color": "#2563eb" } as CSSProperties
const swatchGreenStyle = { "--swatch-color": "#16a34a" } as CSSProperties
const swatchOrangeStyle = { "--swatch-color": "#f97316" } as CSSProperties
const swatchRedStyle = { "--swatch-color": "#dc2626" } as CSSProperties
const canvasStyle: CSSProperties = { touchAction: "none" }

const countNotePages = (content: string | undefined, drawings: string[] | undefined, titles: string[] | undefined) => {
  const html = String(content || "")
  const pageMatches = html.match(/class=["'][^"']*note-page[^"']*["']/g)
  const pageCountFromMarkup = Array.isArray(pageMatches) ? pageMatches.length : 0
  const pageCountFromMeta = Math.max(Array.isArray(drawings) ? drawings.length : 0, Array.isArray(titles) ? titles.length : 0)
  return Math.max(1, pageCountFromMarkup, pageCountFromMeta)
}

export default function NoteEditor() {
  const currentNote = useNotesStore((state) => state.currentNote)
  const isEditing = useNotesStore((state) => state.isEditing)
  const pageCount = countNotePages(currentNote?.content as string | undefined, currentNote?.pageDrawings as string[] | undefined, currentNote?.pageTitles as string[] | undefined)
  const editorClassName = isEditing ? "editor-overlay active" : "editor-overlay"

  return (
    <>
      <div id="note-editor" className={editorClassName} role="dialog" aria-modal="true" aria-label="Редактор" data-lang-aria="editor">
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
                <span id="editor-page-indicator" className="page-indicator" aria-live="polite">{`1/${pageCount}`}</span>
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
            <input key={`title-${currentNote?.id || 'empty'}-${String(currentNote?.updatedAt || '')}`} id="note-title" type="text" defaultValue={String(currentNote?.title || "")} placeholder="Без названия" data-lang-placeholder="note_title" aria-label="Заголовок заметки" data-lang-aria="note_title_aria" />
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
              <div
                key={`content-${currentNote?.id || 'empty'}-${String(currentNote?.updatedAt || '')}`}
                id="note-content-editable"
                className="note-content"
                role="group"
                aria-label="Текст заметки"
                data-lang-aria="note_body_aria"
                dangerouslySetInnerHTML={{ __html: String(currentNote?.content || "") }}
              ></div>
            </div>
          </div>
          <div className="editor-bottom-panel">
            <div className="tags-row" aria-label="Теги" data-lang-aria="tags_aria">
              <input id="note-tags-input" type="text" placeholder="#тег (Enter)" data-lang-placeholder="note_tags" aria-label="Добавить тег" data-lang-aria="note_tags_aria" autoComplete="off" />
              <div id="note-tags-container" className="tags-container" aria-live="polite">
                {(Array.isArray(currentNote?.tags) ? currentNote.tags : []).map((tag) => (
                  <span key={`${currentNote?.id || 'note'}-${tag}`} className="tag-chip">#{String(tag || "")}</span>
                ))}
              </div>
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
    </>
  )
}
