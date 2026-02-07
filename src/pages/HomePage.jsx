import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import NotesList from '../components/NotesList'
import Editor from '../components/Editor'
import useAppStore from '../store/useAppStore'

export default function HomePage({ onSaveNote, onDeleteNote, onToggleFavorite }) {
  const notes = useAppStore((state) => state.notes)
  const searchQuery = useAppStore((state) => state.searchQuery)
  const setSearchQuery = useAppStore((state) => state.setSearchQuery)
  const [selectedNote, setSelectedNote] = useState(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const { t } = useTranslation()

  const openNewNote = () => {
    setSelectedNote(null)
    setIsEditorOpen(true)
  }

  const openExistingNote = (note) => {
    setSelectedNote(note)
    setIsEditorOpen(true)
  }

  const closeEditor = () => {
    setIsEditorOpen(false)
    setSelectedNote(null)
  }

  const handleSave = async (note) => {
    await onSaveNote(note)
    closeEditor()
  }

  const notesCount = useMemo(() => notes.length, [notes])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-white">{t('home.yourNotes')}</h2>
          <p className="text-sm text-slate-400">
            {t('home.notesCount', { count: notesCount })}
          </p>
        </div>
        <div className="flex w-full max-w-sm items-center rounded-full border border-slate-800 bg-slate-900/60 px-4 py-2">
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={t('home.searchPlaceholder')}
            className="w-full bg-transparent text-sm text-slate-200 outline-none"
          />
        </div>
      </div>
      <NotesList
        notes={notes}
        onSelect={openExistingNote}
        onDelete={onDeleteNote}
        onToggleFavorite={onToggleFavorite}
      />
      <button
        type="button"
        onClick={openNewNote}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-3xl font-semibold text-white shadow-xl hover:bg-indigo-400"
        aria-label={t('actions.createNote')}
      >
        +
      </button>
      {isEditorOpen && (
        <Editor note={selectedNote} onSave={handleSave} onClose={closeEditor} />
      )}
    </div>
  )
}
