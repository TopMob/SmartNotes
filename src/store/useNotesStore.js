import { create } from "zustand";

const seedNotes = [
  {
    id: "note-1",
    title: "Добро пожаловать",
    content:
      "<p>Это демо заметка. Попробуйте изменить текст, добавить новую заметку или перетащить карточки.</p>",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    updatedAt: Date.now() - 1000 * 60 * 30,
  },
  {
    id: "note-2",
    title: "Идеи",
    content:
      "<ul><li>Поддержка синхронизации</li><li>Коллаборация</li><li>Шаблоны</li></ul>",
    createdAt: Date.now() - 1000 * 60 * 60 * 8,
    updatedAt: Date.now() - 1000 * 60 * 60,
  },
];

const createNote = (title) => ({
  id: crypto.randomUUID(),
  title,
  content: "<p></p>",
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const useNotesStore = create((set, get) => ({
  notes: seedNotes,
  activeId: seedNotes[0]?.id ?? null,
  setActiveId: (id) => set({ activeId: id }),
  addNote: (title) =>
    set((state) => {
      const note = createNote(title);
      return {
        notes: [note, ...state.notes],
        activeId: note.id,
      };
    }),
  updateNote: (id, payload) =>
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === id
          ? {
              ...note,
              ...payload,
              updatedAt: Date.now(),
            }
          : note
      ),
    })),
  reorderNotes: (nextNotes) => set({ notes: nextNotes }),
  deleteNote: (id) =>
    set((state) => {
      const nextNotes = state.notes.filter((note) => note.id !== id);
      return {
        notes: nextNotes,
        activeId: nextNotes[0]?.id ?? null,
      };
    }),
  getActiveNote: () =>
    get().notes.find((note) => note.id === get().activeId),
}));
