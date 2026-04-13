import { Nav } from '@/components/shared/Nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Sidebar — desktop */}
      <aside className="hidden md:block w-56 border-r border-border bg-white flex-shrink-0 fixed inset-y-0 left-0 z-30">
        <Nav />
      </aside>

      {/* Main content */}
      <main className="flex-1 md:ml-56 pb-20 md:pb-0 min-h-screen bg-bg">
        {children}
      </main>

      {/* Bottom nav — mobile */}
      <div className="md:hidden">
        <Nav />
      </div>
    </div>
  )
}
