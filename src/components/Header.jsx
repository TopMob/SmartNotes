import useAppStore from '../store/useAppStore'
import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebase'

export default function Header() {
  const user = useAppStore((state) => state.user)

  const handleSignOut = async () => {
    await signOut(auth)
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-sm text-slate-400">Welcome back</p>
        <h1 className="text-xl font-semibold">Smart Notes</h1>
      </div>
      {user && (
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">{user.displayName}</p>
            <p className="text-xs text-slate-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-500 hover:text-white"
          >
            Sign out
          </button>
        </div>
      )}
    </header>
  )
}
