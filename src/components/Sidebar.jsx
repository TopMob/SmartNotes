import { useTranslation } from 'react-i18next'
import useAppStore from '../store/useAppStore'

export default function Sidebar() {
  const activeFilter = useAppStore((state) => state.activeFilter)
  const setActiveFilter = useAppStore((state) => state.setActiveFilter)
  const { t } = useTranslation()

  const filters = [
    { id: 'all', label: t('sidebar.allNotes') },
    { id: 'favorites', label: t('sidebar.favorites') }
  ]

  return (
    <aside className="flex h-full flex-col gap-6 border-r border-slate-800 bg-slate-950 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          {t('sidebar.filters')}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
                activeFilter === filter.id
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-300 hover:bg-slate-900'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">
          {t('sidebar.quickLinks')}
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-900"
          >
            {t('sidebar.settings')}
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-900"
          >
            {t('sidebar.about')}
          </button>
          <button
            type="button"
            className="rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-300 transition hover:bg-slate-900"
          >
            {t('sidebar.rate')}
          </button>
        </div>
      </div>
    </aside>
  )
}
