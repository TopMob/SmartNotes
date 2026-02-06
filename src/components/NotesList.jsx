import dayjs from "dayjs";
import Fuse from "fuse.js";
import { Tag, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { cn } from "../lib/utils";
import { useStore } from "../store/useStore";

const NoteCard = ({ note, onDelete }) => (
  <article className="flex h-full flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/70 p-4 shadow-sm transition hover:border-slate-700">
    <div className="space-y-2">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">{note.title}</h3>
          <p className="text-xs text-slate-400">
            {dayjs(note.createdAt).format("DD MMM YYYY")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onDelete(note.id)}
          className="rounded-md border border-transparent p-1 text-slate-400 transition hover:border-slate-700 hover:text-red-300"
          aria-label="Удалить заметку"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </header>
      <p className="text-sm text-slate-300 line-clamp-4">{note.content}</p>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      {note.tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-200"
        >
          <Tag className="h-3 w-3" />
          {tag}
        </span>
      ))}
    </div>
  </article>
);

const NotesList = () => {
  const notes = useStore((state) => state.notes);
  const searchQuery = useStore((state) => state.searchQuery);
  const selectedFolder = useStore((state) => state.selectedFolder);
  const deleteNote = useStore((state) => state.deleteNote);
  const setSearchQuery = useStore((state) => state.setSearchQuery);

  const filteredNotes = useMemo(() => {
    const folderNotes =
      selectedFolder === "all"
        ? notes
        : notes.filter((note) => note.folder === selectedFolder);

    if (!searchQuery.trim()) {
      return folderNotes;
    }

    const fuse = new Fuse(folderNotes, {
      keys: ["title", "content", "tags"],
      threshold: 0.3
    });

    return fuse.search(searchQuery).map((result) => result.item);
  }, [notes, searchQuery, selectedFolder]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Заметки</h2>
          <p className="text-sm text-slate-400">
            Найдено: {filteredNotes.length}
          </p>
        </div>
        <label className="relative w-full sm:max-w-xs">
          <span className="sr-only">Поиск</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по заметкам"
            className={cn(
              "w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-100",
              "placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
            )}
          />
        </label>
      </div>

      {filteredNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-800 p-10 text-center text-slate-400">
          Ничего не найдено. Попробуйте изменить запрос.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredNotes.map((note) => (
            <NoteCard key={note.id} note={note} onDelete={deleteNote} />
          ))}
        </div>
      )}
    </section>
  );
};

export default NotesList;
