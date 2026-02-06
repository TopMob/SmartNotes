import { create } from "zustand";

const initialNotes = [
  {
    id: "note-1",
    title: "Добро пожаловать в Smart Notes",
    content: "Это пример заметки. Замените на свои данные.",
    tags: ["welcome", "demo"],
    folder: "all",
    createdAt: Date.now()
  },
  {
    id: "note-2",
    title: "Идеи",
    content: "Список идей для следующего релиза.",
    tags: ["ideas"],
    folder: "work",
    createdAt: Date.now() - 1000 * 60 * 60 * 24
  }
];

export const useStore = create((set) => ({
  notes: initialNotes,
  searchQuery: "",
  selectedFolder: "all",
  addNote: (note) =>
    set((state) => ({
      notes: [{ ...note, id: crypto.randomUUID() }, ...state.notes]
    })),
  deleteNote: (id) =>
    set((state) => ({
      notes: state.notes.filter((note) => note.id !== id)
    })),
  updateNote: (updatedNote) =>
    set((state) => ({
      notes: state.notes.map((note) =>
        note.id === updatedNote.id ? { ...note, ...updatedNote } : note
      )
    })),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setSelectedFolder: (value) => set({ selectedFolder: value })
}));
