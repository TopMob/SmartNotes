import { useEffect, useMemo, useState } from "react"
import { HashRouter, Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom"
import { onAuthStateChanged } from "firebase/auth"
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc
} from "firebase/firestore"
import AuthPage from "./pages/AuthPage"
import HomePage from "./pages/HomePage"
import Layout from "./components/ui/Layout"
import Editor from "./components/editor/Editor"
import { auth, db } from "./lib/firebase"
import useStore from "./store/useStore"

function EditorPage({ mode }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const user = useStore((state) => state.user)
  const notes = useStore((state) => state.notes)
  const existingNote = useMemo(() => notes.find((note) => note.id === id), [notes, id])

  const [title, setTitle] = useState(existingNote?.title || "")
  const [folder, setFolder] = useState(existingNote?.folder || "Work")
  const [tags, setTags] = useState(existingNote?.tags?.join(", ") || "")
  const [isFavorite, setIsFavorite] = useState(existingNote?.isFavorite || false)

  useEffect(() => {
    if (existingNote) {
      setTitle(existingNote.title)
      setFolder(existingNote.folder)
      setTags(existingNote.tags?.join(", ") || "")
      setIsFavorite(existingNote.isFavorite)
    }
  }, [existingNote])

  const handleSave = async (contentHtml) => {
    if (!user) return
    const contentText = contentHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
    const payload = {
      title: title || "Untitled note",
      content: contentText,
      contentHtml,
      folder,
      tags: tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      isFavorite,
      updatedAt: new Date().toISOString()
    }

    if (mode === "edit" && existingNote) {
      await updateDoc(doc(db, "users", user.uid, "notes", existingNote.id), payload)
    } else {
      await addDoc(collection(db, "users", user.uid, "notes"), payload)
    }

    navigate("/")
  }

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="grid gap-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Title</label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Note title"
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Folder</label>
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100"
          >
            <option value="Work">Work</option>
            <option value="Personal">Personal</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Tags</label>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="design, roadmap"
            className="rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </div>
        <div className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(event) => setIsFavorite(event.target.checked)}
            className="h-4 w-4 rounded border-slate-700 bg-slate-950 text-sky-500"
          />
          <span className="text-sm text-slate-300">Mark as favorite</span>
        </div>
      </div>
      <Editor initialContent={existingNote?.contentHtml || ""} onSave={handleSave} />
    </div>
  )
}

function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="new" element={<EditorPage mode="create" />} />
        <Route path="edit/:id" element={<EditorPage mode="edit" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  const setUser = useStore((state) => state.setUser)
  const setIsAuthLoading = useStore((state) => state.setIsAuthLoading)
  const setNotes = useStore((state) => state.setNotes)
  const isAuthLoading = useStore((state) => state.isAuthLoading)
  const user = useStore((state) => state.user)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setIsAuthLoading(false)
    })

    return () => unsubscribe()
  }, [setUser, setIsAuthLoading])

  useEffect(() => {
    if (!user) {
      setNotes([])
      return
    }

    const notesRef = collection(db, "users", user.uid, "notes")
    const notesQuery = query(notesRef, orderBy("updatedAt", "desc"))
    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const data = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }))
      setNotes(data)
    })

    return () => unsubscribe()
  }, [user, setNotes])

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Loading...
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  )
}
