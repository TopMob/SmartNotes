import { useMemo, useState } from "react";
import { Routes, Route, NavLink } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Fuse from "fuse.js";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { Plus, Settings, Search } from "lucide-react";
import { Toaster, toast } from "react-hot-toast";
import NotesList from "./components/NotesList";
import NoteEditor from "./components/NoteEditor";
import { useNotesStore } from "./store/useNotesStore";

dayjs.extend(relativeTime);

const noteSchema = z.object({
  title: z.string().min(2, "Введите минимум 2 символа"),
});

function NotesPage() {
  const notes = useNotesStore((state) => state.notes);
  const addNote = useNotesStore((state) => state.addNote);
  const [query, setQuery] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(noteSchema),
  });

  const fuse = useMemo(
    () =>
      new Fuse(notes, {
        keys: [
          { name: "title", weight: 0.6 },
          { name: "content", weight: 0.4 },
        ],
        threshold: 0.35,
      }),
    [notes]
  );

  const filteredNotes = useMemo(() => {
    if (!query) return notes;
    return fuse.search(query).map((result) => result.item);
  }, [query, notes, fuse]);

  const onSubmit = (values) => {
    addNote(values.title);
    reset();
    toast.success("Заметка создана");
  };

  return (
    <div className="grid h-[calc(100vh-2rem)] grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside className="flex flex-col gap-6 rounded-3xl border border-slate-800 bg-slate-900/40 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">SmartNotes</h1>
            <p className="text-xs text-slate-400">
              React + Vite + Zustand + Tiptap
            </p>
          </div>
          <NavLink
            to="/settings"
            className="rounded-full border border-slate-800 p-2 text-slate-300 transition hover:border-slate-700 hover:text-slate-100"
          >
            <Settings className="h-4 w-4" />
          </NavLink>
        </div>

        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по заметкам"
            className="w-full rounded-xl border border-slate-800 bg-slate-950/60 py-2 pl-10 pr-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
          />
        </label>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col gap-2"
        >
          <div className="flex items-center gap-2">
            <input
              {...register("title")}
              type="text"
              placeholder="Новая заметка"
              className="flex-1 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-slate-600 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-xl bg-sky-500/80 px-3 py-2 text-sm font-semibold text-white transition hover:bg-sky-500"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {errors.title && (
            <p className="text-xs text-rose-400">{errors.title.message}</p>
          )}
        </form>

        <NotesList filteredNotes={filteredNotes} />
      </aside>

      <section className="flex flex-col gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Редактор</h2>
            <p className="text-xs text-slate-400">
              Tiptap + Tailwind + React Hot Toast
            </p>
          </div>
        </div>
        <NoteEditor />
      </section>
    </div>
  );
}

function SettingsPage() {
  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col items-center justify-center gap-4 rounded-3xl border border-slate-800 bg-slate-900/40 p-8 text-center">
      <h2 className="text-2xl font-semibold">Настройки</h2>
      <p className="text-sm text-slate-400">
        Здесь можно подключить темы, синхронизацию и интеграции.
      </p>
      <NavLink
        to="/"
        className="rounded-xl border border-slate-800 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-700 hover:bg-slate-800"
      >
        Вернуться к заметкам
      </NavLink>
    </div>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100">
      <Routes>
        <Route path="/" element={<NotesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
      <Toaster position="bottom-right" />
    </div>
  );
}
