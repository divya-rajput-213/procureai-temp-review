'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  ShoppingCart,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
  ChevronRight,
  Package,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth.store'

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/vendors',            label: 'Vendors',          icon: Building2 },
  { href: '/budget',             label: 'Budget & Tracking',icon: FileText },
  { href: '/procurement',        label: 'Procurement',      icon: ShoppingCart },
  { href: '/procurement/items',  label: 'Items',            icon: Package },
  { href: '/approvals',          label: 'Approvals',        icon: CheckSquare },
  { href: '/users',              label: 'Users',            icon: Users },
  { href: '/reports',            label: 'Reports',          icon: BarChart3 },
  { href: '/settings',           label: 'Settings',         icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-slate-900 text-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">ProcureAI</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          // Exact match for /settings so it doesn't highlight when on /settings/matrices
          const isActive = item.href === '/settings'
            ? pathname === '/settings'
            : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg text-sm font-medium transition-colors',
                item.indent ? 'px-3 py-2 ml-4' : 'px-3 py-2.5',
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {item.label}
              {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      {/* User info + logout */}
      <div className="p-3 border-t border-slate-700">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            {user?.first_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
