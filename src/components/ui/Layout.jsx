import { Outlet } from "react-router-dom"
import { LogOut, Search } from "lucide-react"
import { signOut } from "firebase/auth"
import useStore from "../../store/useStore"
import { auth } from "../../lib/firebase"

const folders = ["All Notes", "Work", "Personal", "Favorites"]

export default function Layout() {
  const user = useStore((state) => state.user)
  const searchQuery = useStore((state) => state.searchQuery)
  const selectedFolder = useStore((state) => state.selectedFolder)
  const setSearchQuery = useStore((state) => state.setSearchQuery)
  const setSelectedFolder = useStore((state) => state.setSelectedFolder)

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="w-full border-b border-slate-800 bg-slate-900/60 p-6 md:w-72 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between md:block">
            <div>
              <h1 className="text-xl font-semibold">Smart Notes</h1>
              <p className="mt-1 text-sm text-slate-400">Organize your thoughts</p>
            </div>
          </div>
          <nav className="mt-6 flex flex-col gap-2">
            {folders.map((folder) => (
              <button
                key={folder}
                onClick={() => setSelectedFolder(folder)}
                className={`flex w-full items-center justify-between rounded-xl px-4 py-2 text-left text-sm font-medium transition ${
                  selectedFolder === folder
                    ? "bg-slate-800 text-white"
                    : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span>{folder}</span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="flex flex-1 flex-col">
          <header className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950/70 px-6 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex w-full max-w-xl items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search notes"
                className="w-full bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-300">{user?.email}</div>
              <button
                onClick={() => signOut(auth)}
                className="flex items-center gap-2 rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </button>
            </div>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  )
}
