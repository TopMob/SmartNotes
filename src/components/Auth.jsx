import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { LogIn } from "lucide-react";
import { auth } from "../lib/firebase";

const Auth = () => {
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <div className="w-full max-w-md space-y-6 rounded-3xl border border-slate-800 bg-slate-900/70 p-8 text-center shadow-xl">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-slate-400">
            Smart Notes
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Войдите в аккаунт</h1>
          <p className="mt-2 text-sm text-slate-400">
            Используйте Google, чтобы синхронизировать заметки на всех
            устройствах.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-200"
        >
          <LogIn className="h-4 w-4" />
          Войти через Google
        </button>
      </div>
    </div>
  );
};

export default Auth;
