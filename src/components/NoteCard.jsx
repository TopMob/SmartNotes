import dayjs from 'dayjs'

function stripHtml(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export default function NoteCard({ note, onSelect, onDelete, onToggleFavorite }) {
  const preview = stripHtml(note.content || '')
  const updatedAt = note.updatedAt?.toDate ? note.updatedAt.toDate() : note.updatedAt

  return (
    <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/60 p-4 transition hover:border-slate-600">
      <button type="button" onClick={onSelect} className="text-left">
        <h3 className="text-lg font-semibold text-white">{note.title || 'Untitled note'}</h3>
        <p className="mt-2 max-h-16 overflow-hidden text-sm text-slate-300">
          {preview || 'Start writing to see a preview.'}
        </p>
      </button>
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <span>{updatedAt ? dayjs(updatedAt).format('MMM D, YYYY h:mm A') : 'Just now'}</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFavorite}
            className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-200 hover:border-slate-500"
          >
            {note.favorite ? 'Starred' : 'Star'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded-full border border-red-500/60 px-3 py-1 text-xs text-red-200 hover:border-red-400"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}
