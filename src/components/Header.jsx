import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import useAppStore from '../store/useAppStore'
import { signOut } from 'firebase/auth'
import { auth } from '../utils/firebase'

export default function Header() {
  const user = useAppStore((state) => state.user)
  const { t } = useTranslation()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase()

  const handleSignOut = async () => {
    await signOut(auth)
  }

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-semibold">{t('appName')}</h1>
      </div>
      {user && (
        <div className="relative flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-slate-200">
              {user.displayName || user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border border-slate-700 bg-slate-900 text-sm font-semibold text-slate-100"
            aria-label={t('header.account')}
          >
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || user.email}
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 top-14 w-48 rounded-2xl border border-slate-800 bg-slate-950 p-2 shadow-xl">
              <div className="px-3 py-2 text-xs text-slate-400">{user.email}</div>
              <button
                type="button"
                onClick={handleSignOut}
                className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm text-slate-200 transition hover:bg-slate-900"
              >
                {t('actions.signOut')}
                <span className="text-xs text-slate-500">⏎</span>
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  )
}
