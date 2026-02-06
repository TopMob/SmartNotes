import useAppStore from '../store/useAppStore'

const filters = [
  { id: 'all', label: 'All notes' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'favorites', label: 'Favorites' }
]

export default function Sidebar() {
  const activeFilter = useAppStore((state) => state.activeFilter)
  const setActiveFilter = useAppStore((state) => state.setActiveFilter)

  return (
    <aside className="flex h-full flex-col gap-6 border-r border-slate-800 bg-slate-950 px-4 py-6">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Filters</p>
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
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <p className="font-semibold text-white">Tips</p>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          Use the editor to capture thoughts, then organize them with search and filters.
        </p>
      </div>
    </aside>
  )
}
