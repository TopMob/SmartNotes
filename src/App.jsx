import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import Auth from "./components/Auth";
import Editor from "./components/Editor";
import Layout from "./components/Layout";
import NotesList from "./components/NotesList";
import { useAuth } from "./hooks/useAuth";
import { useNotesSync } from "./hooks/useNotesSync";
import { useStore } from "./store/useStore";

const NotesPage = () => {
  useNotesSync();

  return (
    <div className="space-y-6">
      <NotesList />
      <Editor />
    </div>
  );
};

const LoadingScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
    <div className="flex flex-col items-center gap-3">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-slate-200" />
      <p className="text-sm text-slate-400">Загрузка...</p>
    </div>
  </div>
);

const AppContent = () => {
  const authStatus = useStore((state) => state.authStatus);

  if (authStatus === "loading") {
    return <LoadingScreen />;
  }

  if (authStatus === "unauthenticated") {
    return <Auth />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<NotesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
};

const App = () => {
  useAuth();

  return (
    <HashRouter>
      <AppContent />
    </HashRouter>
  );
};

export default App;
