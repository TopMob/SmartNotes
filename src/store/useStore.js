import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { create } from "zustand";
import { db } from "../lib/firebase";

export const useStore = create((set) => ({
  notes: [],
  searchQuery: "",
  selectedFolder: "all",
  user: null,
  authStatus: "loading",
  setNotes: (notes) => set({ notes }),
  setUser: (user) => set({ user }),
  setAuthStatus: (status) => set({ authStatus: status }),
  setSearchQuery: (value) => set({ searchQuery: value }),
  setSelectedFolder: (value) => set({ selectedFolder: value }),
  addNote: async (userId, newNote) => {
    if (!userId) return;
    await addDoc(collection(db, "users", userId, "notes"), newNote);
  },
  deleteNote: async (userId, noteId) => {
    if (!userId || !noteId) return;
    await deleteDoc(doc(db, "users", userId, "notes", noteId));
  },
  updateNote: async (userId, noteId, updatedData) => {
    if (!userId || !noteId) return;
    await updateDoc(doc(db, "users", userId, "notes", noteId), updatedData);
  }
}));
