'use client'

import { useState, useEffect, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, Check, CheckCheck, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import apiClient from '@/lib/api/client'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/vendors': 'Vendor Management',
  '/budget': 'Budget & Tracking IDs',
  '/procurement': 'Purchase Requisitions',
  '/contracts': 'Contract Management',
  '/contracts/templates': 'Contract Templates',
  '/contracts/clauses': 'Clause Library',
  '/purchase-orders': 'Purchase Orders',
  '/invoices': 'Invoices',
  '/approvals': 'Approvals',
  '/inventory': "Inventory",
  '/users': 'User Management',
  '/settings/plants': 'Plants',
  '/settings/vendor-categories': 'Vendor Categories',
  '/settings': 'Settings',
  '/profile': 'Profile',
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function notifTypeColor(type: string): string {
  if (type === 'approval_assigned') return 'bg-blue-100 text-blue-700'
  if (type === 'approval_approved') return 'bg-green-100 text-green-700'
  if (type === 'approval_rejected') return 'bg-red-100 text-red-700'
  return 'bg-slate-100 text-slate-600'
}

function notifTypeLabel(type: string): string {
  if (type === 'approval_assigned') return 'Action Required'
  if (type === 'approval_approved') return 'Approved'
  if (type === 'approval_rejected') return 'Rejected'
  return 'Info'
}

export function TopBar({ onMenuToggle }: { onMenuToggle?: () => void } = {}) {
  const pathname = usePathname()
  const router = useRouter()

  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const pageKey = Object.keys(PAGE_TITLES).find((k) => pathname.startsWith(k)) || pathname
  const title = PAGE_TITLES[pageKey] || 'ProcureAI'

  // Poll unread count every 30s
  useEffect(() => {
    const fetchCount = () => {
      apiClient.get('/notifications/unread-count/')
        .then(r => setUnreadCount(r.data.count))
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30_000)
    return () => clearInterval(interval)
  }, [])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const openPanel = async () => {
    setOpen(prev => !prev)
    if (!open) {
      setLoading(true)
      try {
        const r = await apiClient.get('/notifications/')
        setNotifications(r.data.results ?? r.data)
      } finally {
        setLoading(false)
      }
    }
  }

  const markRead = async (id: string) => {
    await apiClient.patch(`/notifications/${id}/mark-read/`)
    setNotifications(prev => prev.map(n => (n.hash_id ?? n.id) === id ? { ...n, is_read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await apiClient.post('/notifications/mark-all-read/')
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    setUnreadCount(0)
  }

  return (
    <header className="h-14 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        {onMenuToggle && (
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle}>
            <Menu className="w-5 h-5" />
          </Button>
        )}
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={panelRef}>
          <Button variant="ghost" size="icon" className="relative" onClick={openPanel}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>

          {open && (
            <div className="absolute right-0 top-full mt-1 w-80 bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2.5 border-b">
                <span className="text-sm font-semibold">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-96 overflow-y-auto divide-y">
                {loading && (
                  <div className="px-4 py-6 text-sm text-center text-muted-foreground">Loading…</div>
                )}
                {!loading && notifications.length === 0 && (
                  <div className="px-4 py-6 text-sm text-center text-muted-foreground">No notifications yet.</div>
                )}
                {!loading && notifications.map(n => (
                  <div
                    key={n.id}
                    className={`px-4 py-3 cursor-pointer transition-colors ${n.is_read ? 'hover:bg-slate-50' : 'bg-blue-50/40 hover:bg-blue-50'}`}
                    onClick={() => {
                      if (!n.is_read) markRead(n.hash_id ?? n.id)
                      if (n.link) router.push(n.link)
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${notifTypeColor(n.type)}`}>
                            {notifTypeLabel(n.type)}
                          </span>
                          {!n.is_read && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full shrink-0" />}
                        </div>
                        <p className="text-sm font-medium leading-tight truncate">{n.title}</p>
                        {n.message && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        )}
                      </div>
                      {!n.is_read && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(n.hash_id ?? n.id) }}
                          className="shrink-0 text-muted-foreground hover:text-blue-600 mt-0.5"
                          title="Mark as read"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}
