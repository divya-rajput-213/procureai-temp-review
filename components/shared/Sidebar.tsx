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
  Settings,
  LogOut,
  ChevronRight,
  Package,
  Pencil,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useState, useEffect, useRef } from 'react'
import { Badge } from '@/components/ui/badge'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, indent: false },
  { href: '/vendors', label: 'Vendors', icon: Building2, indent: false },
  { href: '/budget', label: 'Budget & Tracking', icon: FileText, indent: false },
  { href: '/procurement', label: 'Procurement', icon: ShoppingCart, indent: false },
  { href: '/approvals', label: 'Approvals', icon: CheckSquare, indent: false },
  {
    label: 'Inventory',
    icon: Package,
    children: [
      { href: '/inventory/categories', label: 'Categories' },
      { href: '/inventory/items', label: 'Items' },
    ],
  },
  {
    label: 'Masters',
    icon: Pencil,
    children: [
      { href: '/settings/plants', label: 'Plants' },
      { href: '/settings/vendor-categories', label: 'Vendor Categories' },
    ],
  },
  { href: '/users', label: 'Users', icon: Users, indent: false },
  { href: '/settings', label: 'Settings', icon: Settings, indent: false },
]

function SidebarProfile({ user, onLogout }: { user: any; onLogout: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div className="relative p-3 border-t border-white/10" ref={ref}>
      {/* Dropdown opens upward */}
      {open && (
        <div className="absolute bottom-full left-2 right-2 mb-2 bg-white text-slate-800 border rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-600 text-white text-sm font-semibold flex items-center justify-center shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{user?.first_name} {user?.last_name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Profile details */}
          <div className="px-4 py-3 space-y-2 text-sm">
            {([
              ['Designation', user?.designation || '—'],
              ['Account Type', user?.account_type],
              ['Plant', user?.plant_name || '—'],
              ['Department', user?.department_name || '—'],
            ] as [string, string | undefined][]).map(([label, value]) => (
              <div key={label} className="flex justify-between">
                <span className="text-muted-foreground text-xs">{label}</span>
                <span className="text-xs font-medium">{value ?? '—'}</span>
              </div>
            ))}
            {user?.roles && user.roles.length > 0 && (
              <div className="flex justify-between items-start">
                <span className="text-muted-foreground text-xs">Roles</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {user.roles.map((r: any) => (
                    <Badge key={r.id} variant="secondary" className="text-[10px] h-5">{r.display_name}</Badge>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={() => { setOpen(false); router.push('/profile') }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground pt-1"
            >
              <Pencil className="w-3 h-3" /> Edit profile
            </button>
          </div>

          {/* Logout */}
          <div className="border-t">
            <button
              onClick={onLogout}
              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" /> Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-white/10 transition-colors"
      >
        <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-xs font-medium text-white truncate">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-white/50 truncate">{user?.email}</p>
        </div>
      </button>
    </div>
  )
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Inventory: false, // opened by default
  })

  const pathname = usePathname()
  const router = useRouter()
  const { user, company, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="w-64 bg-black text-white flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={()=> router.push('/dashboard')}>
          {company?.logo ? (
            <img
              src={company.logo}
              alt={company.name}
              className="w-8 h-8 rounded-lg object-contain bg-white"
            />
          ) : (
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4 text-black"
              >
                <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
              </svg>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-lg font-bold leading-tight truncate">
              {company?.name || 'ProcureAI'}
            </p>
            <p className="text-[10px] font-medium text-white/50 leading-tight">ProcureAI</p>
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
                          onClick={onNavigate}
                          className={cn(
                            "flex items-center px-3 py-2 text-sm rounded-lg",
                            isActive
                              ? "bg-[rgb(61,61,64)]  text-white"
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
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                isActive
                  ? "bg-[rgb(61,61,64)] text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>


      {/* User profile */}
      <SidebarProfile user={user} onLogout={handleLogout} />
    </aside>
  )
}
