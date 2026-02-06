import { GoogleAuthProvider, signInWithPopup } from "firebase/auth"
import { auth } from "../lib/firebase"

export default function AuthPage() {
  const handleSignIn = async () => {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-xl">
        <h1 className="text-2xl font-semibold text-white">Smart Notes</h1>
        <p className="mt-2 text-sm text-slate-400">Sign in to sync your notes</p>
        <button
          onClick={handleSignIn}
          className="mt-8 w-full rounded-xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  )
}
