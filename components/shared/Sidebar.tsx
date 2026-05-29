'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Building2,
  FileText,
  FileSignature,
  ShoppingCart,
  ClipboardList,
  Receipt,
  GitCompare,
  CheckSquare,
  Settings,
  LogOut,
  ChevronRight,
  Package,
  Pencil,
  PanelLeftClose,
  PanelLeftOpen,
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
  { href: '/quotation', label: 'Quotation', icon: FileText, indent: false },

  // {
  //   label: 'Contracts',
  //   icon: FileSignature,
  //   children: [
  //     { href: '/contracts', label: 'All Contracts' },
  //     { href: '/contracts/templates', label: 'Templates' },
  //     { href: '/contracts/clauses', label: 'Clause Library' },
  //   ],
  // },
  { href: '/purchase-orders', label: 'Purchase Orders', icon: ClipboardList, indent: false },
  { href: '/grns', label: 'GRN / Delivery', icon: Package, indent: false },
  { href: '/invoices', label: 'Invoices', icon: Receipt, indent: false },
  { href: '/matching', label: '3-Way Matching', icon: GitCompare, indent: false },
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

function SidebarProfile({ user, onLogout }: Readonly<{ user: any; onLogout: () => void }>) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handler)
    }

    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const initials =
    `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div
      ref={ref}
      className="relative p-3 border-t border-[#DDE3EE] bg-white"
    >
      {/* Dropdown */}
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-3 overflow-hidden rounded-xl border border-[#DDE3EE] bg-white shadow-xl z-50">
          {/* Header */}
          <div className="border-b border-[#E8ECF3] bg-[#F7F9FD] px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2563EB] text-sm font-semibold text-white">
                {initials}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0F1A2E]">
                  {user?.first_name} {user?.last_name}
                </p>

                <p className="truncate text-xs text-[#6A7388]">
                  {user?.email}
                </p>
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="space-y-3 px-4 py-4">
            {([
              ['Designation', user?.designation || '—'],
              ['Account Type', user?.account_type || '—'],
              ['Plant', user?.plant_name || '—'],
              ['Department', user?.department_name || '—'],
            ] as [string, string][]).map(([label, value]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-xs font-medium text-[#6A7388]">
                  {label}
                </span>

                <span className="text-xs font-semibold text-[#0F1A2E] text-right">
                  {value}
                </span>
              </div>
            ))}

            {user?.roles?.length > 0 && (
              <div className="flex items-start justify-between gap-3">
                <span className="pt-1 text-xs font-medium text-[#6A7388]">
                  Roles
                </span>

                <div className="flex flex-wrap justify-end gap-1">
                  {user.roles.map((r: any) => (
                    <Badge
                      key={r.id}
                      className="border-[#C3D5F8] bg-[#E8EFFD] text-[10px] text-[#2563EB] hover:bg-[#E8EFFD]"
                    >
                      {r.display_name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setOpen(false)
                router.push('/profile')
              }}
              className="flex items-center gap-2 pt-1 text-xs font-medium text-[#6A7388] transition-colors hover:text-[#2563EB]"
            >
              <Pencil className="h-3.5 w-3.5" />
              Edit profile
            </button>
          </div>

          {/* Footer */}
          <div className="border-t border-[#E8ECF3]">
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-[#C84A33] transition-colors hover:bg-[#FBE1D9]"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Trigger */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className="flex w-full items-center gap-3 rounded-xl border border-transparent px-2 py-2 transition-all hover:border-[#DDE3EE] hover:bg-[#F7F9FD]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#6D55D8] text-xs font-bold text-white">
          {initials}
        </div>

        <div className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold text-[#0F1A2E]">
            {user?.first_name} {user?.last_name}
          </p>

          <p className="truncate text-xs text-[#6A7388]">
            {user?.email}
          </p>
        </div>
      </button>
    </div>
  )
}

function CollapsedNavIcon({ href, icon: Icon, label, isActive, onClick }: Readonly<{ href: string; icon: React.ElementType; label: string; isActive: boolean; onClick?: () => void }>) {
  return (
    <div className="flex justify-center">
      <Link
        href={href}
        onClick={onClick}
        title={label}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-lg border transition-all",
          isActive ? "bg-primary border-primary/20 text-white shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted hover:border-border"
        )}
      >
        <Icon className="w-[18px] h-[18px]" />
      </Link>
    </div>
  )
}

function CollapsedGroupIcon({ icon: Icon, label, isActive, onClick }: Readonly<{ icon: React.ElementType; label: string; isActive: boolean; onClick: () => void }>) {
  return (
    <div className="flex justify-center">
      <button
        type="button"
        title={label}
        onClick={onClick}
        className={cn(
          "w-10 h-10 flex items-center justify-center rounded-lg border transition-all",
          isActive ? "bg-primary border-primary/20 text-white shadow-sm" : "border-transparent text-muted-foreground hover:bg-muted hover:border-border"
        )}
      >
        <Icon className="w-[18px] h-[18px]" />
      </button>
    </div>
  )
}

export function Sidebar({ onNavigate, collapsed = false, onToggleCollapse }: { onNavigate?: () => void; collapsed?: boolean; onToggleCollapse?: () => void } = {}) {
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Inventory: false,
  })

  const pathname = usePathname()
  const router = useRouter()
  const { user, company, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    router.push('/login')
  }

  return (
    <aside className="bg-[#ffffff] border-r border-border text-foreground flex flex-col h-full shrink-0 shadow-sm overflow-hidden w-full">
      {/* Logo */}
      <div className="h-14 px-3 flex items-center justify-between border-b border-border shrink-0">
        {!collapsed && (
          <button
            type="button"
            className="flex items-center gap-2 min-w-0 flex-1 text-left"
            onClick={() => router.push('/dashboard')}
          >
            {company?.logo ? (
              <img
                src={company.logo}
                alt={company.name}
                className="w-7 h-7 rounded-md object-contain bg-card border border-border shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-primary/10">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-4 w-4 text-primary"
                >
                  <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
                </svg>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-lg font-bold leading-tight truncate text-foreground">
                {company?.name || 'ProcureAI'}
              </p>
              <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                Procurement Platform
              </p>
            </div>
          </button>
        )}
        {collapsed && (
          <button
            type="button"
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border border-border bg-primary/10 mx-auto"
            onClick={() => router.push('/dashboard')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-primary">
              <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="shrink-0 p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <div className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon

            if (item.children) {
              const isOpen = openMenus[item.label]

              if (collapsed) {
                const anyChildActive = item.children.some(c => pathname.startsWith(c.href))
                return (
                  <CollapsedGroupIcon
                    key={item.label}
                    icon={Icon}
                    label={item.label}
                    isActive={anyChildActive}
                    onClick={() => setOpenMenus(prev => ({ ...prev, [item.label]: !prev[item.label] }))}
                  />
                )
              }

              return (
                <div key={item.label}>
                  <button
                    onClick={() =>
                      setOpenMenus(prev => ({
                        ...prev,
                        [item.label]: !prev[item.label],
                      }))
                    }
                    className={cn(
                      "w-full flex items-center gap-3 px-3 h-10 rounded-lg text-[15px] font-semibold transition-all border",
                      isOpen
                        ? "bg-primary border-primary/20 text-[white] shadow-sm"
                        : "border-transparent text-secondary-foreground hover:bg-muted hover:border-border"
                    )}
                  >
                    <Icon className={cn("w-4 h-4", isOpen ? "text-[white]" : "text-muted-foreground")} />
                    <span>{item.label}</span>
                    <ChevronRight className={cn("w-4 h-4 ml-auto text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                  </button>

                  {isOpen && (
                    <div className="ml-7 mt-1 space-y-1">
                      {item.children.map((child) => {
                        const isActive = pathname.startsWith(child.href)
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center h-9 px-3 rounded-lg text-[14px] font-medium border transition-all",
                              isActive
                                ? "bg-primary border-primary/20 text-[white] shadow-sm"
                                : "border-transparent text-muted-foreground hover:bg-muted hover:border-border hover:text-foreground"
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

            const isActive =
              item.href === '/settings'
                ? pathname === '/settings'
                : pathname.startsWith(item.href)

            if (collapsed) {
              return (
                <CollapsedNavIcon
                  key={item.href}
                  href={item.href}
                  icon={Icon}
                  label={item.label}
                  isActive={isActive}
                  onClick={onNavigate}
                />
              )
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "group flex items-center gap-3 px-3 h-10 rounded-lg text-[15px] font-semibold border transition-all",
                  isActive
                    ? "bg-primary border-primary/20 text-[white] shadow-sm"
                    : "border-transparent text-secondary-foreground hover:bg-muted hover:border-border"
                )}
              >
                <Icon
                  className={cn(
                    "w-[18px] h-[18px]",
                    isActive ? "text-[white]" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User profile */}
      <div className="border-t border-border bg-card">
        <SidebarProfile user={user} onLogout={handleLogout} />
      </div>
    </aside>
  )
}
