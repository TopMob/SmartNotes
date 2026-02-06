import { Link } from "react-router-dom"
import dayjs from "dayjs"
import { doc, deleteDoc } from "firebase/firestore"
import { Trash2 } from "lucide-react"
import { db } from "../../lib/firebase"

export default function NoteCard({ note, userId }) {
  const formattedDate = note.updatedAt ? dayjs(note.updatedAt).format("MMM D, YYYY") : ""

  const handleDelete = async () => {
    if (!userId) return
    await deleteDoc(doc(db, "users", userId, "notes", note.id))
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">{note.title}</h3>
          <p className="mt-1 text-xs text-slate-400">{formattedDate}</p>
        </div>
        <button
          onClick={handleDelete}
          className="rounded-full border border-slate-800 p-2 text-slate-400 transition hover:text-rose-400"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <p className="mt-3 line-clamp-4 text-sm text-slate-300">{note.content}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {note.tags?.map((tag) => (
          <span key={tag} className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">
            {tag}
          </span>
        ))}
      </div>
      <div className="mt-4">
        <Link
          to={`/edit/${note.id}`}
          className="inline-flex items-center text-sm font-medium text-sky-400 hover:text-sky-300"
        >
          Edit note
        </Link>
      </div>
    </div>
  )
}
