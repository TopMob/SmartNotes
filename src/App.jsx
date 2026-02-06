import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import NotesList from "./components/NotesList";
import Editor from "./components/Editor";

const NotesPage = () => (
  <div className="space-y-6">
    <NotesList />
    <Editor />
  </div>
);

const App = () => (
  <HashRouter>
    <Layout>
      <Routes>
        <Route path="/" element={<NotesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  </HashRouter>
);

export default App;
