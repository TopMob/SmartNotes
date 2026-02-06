import { Folder, Home, Star } from "lucide-react";
import { useStore } from "../store/useStore";
import { cn } from "../lib/utils";

const folders = [
  { id: "all", label: "Все заметки", icon: Home },
  { id: "work", label: "Работа", icon: Folder },
  { id: "favorite", label: "Избранное", icon: Star }
];

const Layout = ({ children }) => {
  const selectedFolder = useStore((state) => state.selectedFolder);
  const setSelectedFolder = useStore((state) => state.setSelectedFolder);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="flex">
        <aside className="hidden w-64 flex-col border-r border-slate-800 bg-slate-900 md:flex">
          <div className="px-6 py-5 text-lg font-semibold">Smart Notes</div>
          <nav className="flex-1 space-y-1 px-3 pb-6">
            {folders.map((folder) => {
              const Icon = folder.icon;
              const isActive = selectedFolder === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => setSelectedFolder(folder.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition",
                    isActive
                      ? "bg-slate-800 text-white"
                      : "text-slate-300 hover:bg-slate-800/60"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {folder.label}
                </button>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
