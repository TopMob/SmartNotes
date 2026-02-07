import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp
} from 'firebase/firestore'
import { useTranslation } from 'react-i18next'
import { auth, db } from './utils/firebase'
import useAppStore from './store/useAppStore'
import Layout from './components/Layout'
import AuthPage from './pages/AuthPage'
import HomePage from './pages/HomePage'
import i18n from './i18n'

export default function App() {
  const user = useAppStore((state) => state.user)
  const authLoading = useAppStore((state) => state.authLoading)
  const setUser = useAppStore((state) => state.setUser)
  const setAuthLoading = useAppStore((state) => state.setAuthLoading)
  const setNotes = useAppStore((state) => state.setNotes)
  const settings = useAppStore((state) => state.settings)
  const { t } = useTranslation()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
      setAuthLoading(false)
    })
    return () => unsubscribe()
  }, [setUser, setAuthLoading])

  useEffect(() => {
    if (settings?.language && i18n.language !== settings.language) {
      i18n.changeLanguage(settings.language)
    }
  }, [settings])

  useEffect(() => {
    if (!user) {
      setNotes([])
      return () => {}
    }
    const notesRef = collection(db, 'users', user.uid, 'notes')
    const notesQuery = query(notesRef, orderBy('updatedAt', 'desc'))
    const unsubscribe = onSnapshot(notesQuery, (snapshot) => {
      const items = snapshot.docs.map((document) => ({
        id: document.id,
        ...document.data()
      }))
      setNotes(items)
    })
    return () => unsubscribe()
  }, [user, setNotes])

  const handleSaveNote = async (note) => {
    if (!user) {
      return
    }
    const payload = {
      title: note.title || t('defaults.untitledNote'),
      content: note.content || '',
      favorite: note.favorite || false,
      updatedAt: serverTimestamp()
    }
    const notesRef = collection(db, 'users', user.uid, 'notes')
    if (note.id) {
      await updateDoc(doc(notesRef, note.id), payload)
      return
    }
    await addDoc(notesRef, {
      ...payload,
      createdAt: serverTimestamp()
    })
  }

  const handleDeleteNote = async (note) => {
    if (!user || !note.id) {
      return
    }
    await deleteDoc(doc(db, 'users', user.uid, 'notes', note.id))
  }

  const handleToggleFavorite = async (note) => {
    if (!user || !note.id) {
      return
    }
    await updateDoc(doc(db, 'users', user.uid, 'notes', note.id), {
      favorite: !note.favorite,
      updatedAt: serverTimestamp()
    })
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        {t('loading')}
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/auth"
          element={user ? <Navigate to="/" replace /> : <AuthPage />}
        />
        <Route
          path="/"
          element={
            user ? (
              <Layout>
                <HomePage
                  onSaveNote={handleSaveNote}
                  onDeleteNote={handleDeleteNote}
                  onToggleFavorite={handleToggleFavorite}
                />
              </Layout>
            ) : (
              <Navigate to="/auth" replace />
            )
          }
        />
        <Route path="*" element={<Navigate to={user ? '/' : '/auth'} replace />} />
      </Routes>
    </HashRouter>
  )
}
