import { useMemo } from "react"
import Fuse from "fuse.js"
import useStore from "../../store/useStore"
import NoteCard from "./NoteCard"

export default function NotesList() {
  const notes = useStore((state) => state.notes)
  const searchQuery = useStore((state) => state.searchQuery)
  const selectedFolder = useStore((state) => state.selectedFolder)
  const user = useStore((state) => state.user)

  const filteredNotes = useMemo(() => {
    let result = notes

    if (selectedFolder === "Favorites") {
      result = result.filter((note) => note.isFavorite)
    } else if (selectedFolder !== "All Notes") {
      result = result.filter((note) => note.folder === selectedFolder)
    }

    if (!searchQuery.trim()) return result

    const fuse = new Fuse(result, {
      keys: ["title", "content", "tags"],
      threshold: 0.3
    })

    return fuse.search(searchQuery).map((item) => item.item)
  }, [notes, searchQuery, selectedFolder])

  if (!filteredNotes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-900/40 p-10 text-center">
        <h2 className="text-lg font-semibold text-slate-200">No notes found</h2>
        <p className="mt-2 text-sm text-slate-400">Create a new note to get started.</p>
      </div>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {filteredNotes.map((note) => (
        <NoteCard key={note.id} note={note} userId={user?.uid} />
      ))}
    </div>
  )
}
