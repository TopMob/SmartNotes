import { signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../utils/firebase'

export default function AuthPage() {
  const handleSignIn = async () => {
    await signInWithPopup(auth, googleProvider)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-2xl">
        <h1 className="text-3xl font-semibold text-white">Smart Notes</h1>
        <p className="mt-3 text-sm text-slate-300">
          Sign in to access your notes across devices and keep them safely synced.
        </p>
        <button
          type="button"
          onClick={handleSignIn}
          className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-100"
        >
          Continue with Google
        </button>
      </div>
    </div>
  )
}
