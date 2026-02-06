import { Plus } from "lucide-react"
import { useNavigate } from "react-router-dom"
import NotesList from "../components/notes/NotesList"

export default function HomePage() {
  const navigate = useNavigate()

  return (
    <div className="relative">
      <NotesList />
      <button
        onClick={() => navigate("/new")}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-sky-500 text-white shadow-lg transition hover:bg-sky-400"
      >
        <Plus className="h-6 w-6" />
      </button>
    </div>
  )
}
