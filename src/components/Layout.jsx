import Header from './Header'
import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <Header />
      <div className="flex flex-1">
        <div className="hidden w-64 lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 px-6 py-6 lg:px-10">{children}</main>
      </div>
    </div>
  )
}
