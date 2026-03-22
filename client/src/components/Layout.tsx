import { useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Package,
  FileText,
  Users,
  Warehouse,
  MapPin,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

const navItems = [
  { to: '/', label: '總覽', icon: LayoutDashboard },
  { to: '/equipment', label: '器材管理', icon: Package },
  { to: '/rentals', label: '租賃管理', icon: FileText },
  { to: '/customers', label: '客戶管理', icon: Users },
  { to: '/inventory', label: '庫存管理', icon: Warehouse },
  { to: '/venues', label: '場地管理', icon: MapPin },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r bg-sidebar-background transition-transform lg:static lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-14 items-center justify-between border-b px-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-sidebar-foreground no-underline">
            <Package className="h-6 w-6" />
            <span>GearBase</span>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const isActive = item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to)
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm no-underline transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
              {user?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.role}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-4 border-b px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground">
            {navItems.find(n => n.to === '/' ? location.pathname === '/' : location.pathname.startsWith(n.to))?.label || 'GearBase'}
          </h1>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
