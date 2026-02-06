import Fuse from 'fuse.js'
import dayjs from 'dayjs'
import useAppStore from '../store/useAppStore'
import NoteCard from './NoteCard'

export default function NotesList({ notes, onSelect, onDelete, onToggleFavorite }) {
  const searchQuery = useAppStore((state) => state.searchQuery)
  const activeFilter = useAppStore((state) => state.activeFilter)

  const sortedNotes = [...notes].sort((a, b) => {
    const aTime = a.updatedAt?.toMillis ? a.updatedAt.toMillis() : new Date(a.updatedAt).getTime()
    const bTime = b.updatedAt?.toMillis ? b.updatedAt.toMillis() : new Date(b.updatedAt).getTime()
    return bTime - aTime
  })

  const filteredByFilter = sortedNotes.filter((note) => {
    if (activeFilter === 'favorites') {
      return note.favorite
    }
    if (activeFilter === 'recent') {
      const updatedAt = note.updatedAt?.toDate ? note.updatedAt.toDate() : note.updatedAt
      if (!updatedAt) {
        return false
      }
      return dayjs(updatedAt).isAfter(dayjs().subtract(7, 'day'))
    }
    return true
  })

  const fuse = new Fuse(filteredByFilter, {
    keys: ['title', 'content', 'tags'],
    threshold: 0.3,
    ignoreLocation: true
  })

  const results = searchQuery
    ? fuse.search(searchQuery).map((result) => result.item)
    : filteredByFilter

  if (!results.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-800 bg-slate-900/40 p-12 text-center text-slate-400">
        <h3 className="text-lg font-semibold text-white">No notes yet</h3>
        <p className="mt-2 text-sm">Create a new note or adjust your search to see results.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {results.map((note) => (
        <NoteCard
          key={note.id}
          note={note}
          onSelect={() => onSelect(note)}
          onDelete={() => onDelete(note)}
          onToggleFavorite={() => onToggleFavorite(note)}
        />
      ))}
    </div>
  )
}
