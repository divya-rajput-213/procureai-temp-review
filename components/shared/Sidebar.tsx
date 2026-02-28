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
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard',          label: 'Dashboard',        icon: LayoutDashboard, indent: false },
  { href: '/vendors',            label: 'Vendors',          icon: Building2, indent: false },
  { href: '/budget',             label: 'Budget & Tracking',icon: FileText, indent: false },
  { href: '/procurement',        label: 'Procurement',      icon: ShoppingCart, indent: false },
  { href: '/approvals',          label: 'Approvals',        icon: CheckSquare, indent: false },
  {
    label: 'Inventory',
    icon: Package,
    children: [
      { href: '/inventory/items', label: 'Items' },
    ],
  },  
  { href: '/users',              label: 'Users',            icon: Users, indent: false },
  { href: '/reports',            label: 'Reports',          icon: BarChart3, indent: false },
  { href: '/settings',           label: 'Settings',         icon: Settings, indent: false },
]

export function Sidebar() {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Inventory: true, // opened by default
  })
  
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-black text-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            {/* <Building2 className="w-5 h-5 text-white" /> */}
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" 
            className="lucide lucide-zap h-4 w-4 text-sidebar-primary-foreground"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"></path></svg>
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">ProcureAI</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
  {NAV_ITEMS.map((item) => {
    const Icon = item.icon

    // ---------- Parent with children ----------
    if (item.children) {
      const isOpen = openMenus[item.label]

      return (
        <div key={item.label}>
          <button
            onClick={() =>
              setOpenMenus(prev => ({
                ...prev,
                [item.label]: !prev[item.label],
              }))
            }
            className="flex items-center w-full gap-3 px-3 py-2.5 rounded-lg text-sm text-white/70 hover:bg-white/10 hover:text-white"
          >
            <Icon className="w-4 h-4" />
            {item.label}
            <ChevronRight
              className={cn(
                "w-4 h-4 ml-auto transition-transform",
                isOpen && "rotate-90"
              )}
            />
          </button>

          {isOpen && (
            <div className="ml-6 mt-1 space-y-1">
              {item.children.map((child) => {
                const isActive = pathname.startsWith(child.href)

                return (
                  <Link
                    key={child.href}
                    href={child.href}
                    className={cn(
                      "flex items-center px-3 py-2 text-sm rounded-lg",
                      isActive
                        ? "bg-indigo-600 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {child.label}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )
    }

    // ---------- Normal Item ----------
    const isActive =
      item.href === '/settings'
        ? pathname === '/settings'
        : pathname.startsWith(item.href)

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
          isActive
            ? "bg-indigo-600 text-white"
            : "text-white/70 hover:bg-white/10 hover:text-white"
        )}
      >
        <Icon className="w-4 h-4" />
        {item.label}
      </Link>
    )
  })}
</nav>


      {/* User info + logout */}
      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-1">
          <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
            {user?.first_name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-white truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-white/50 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 text-sm text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
