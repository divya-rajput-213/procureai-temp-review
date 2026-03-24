import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currencyCode?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  if (Number.isNaN(num)) return '—'
  // Read from settings store if no override provided (works outside React via getState)
  let code = currencyCode
  if (!code) {
    try {
      // Dynamic import to avoid circular deps at module load time
      const { useSettingsStore } = require('@/lib/stores/settings.store')
      code = useSettingsStore.getState().currencyCode
    } catch {
      code = 'INR'
    }
  }
  const safeCode = code || 'INR'
  const locale = safeCode === 'INR' ? 'en-IN' : 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: safeCode,
    maximumFractionDigits: 2,
  }).format(num)
}

export function formatDate(date: string | Date): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  if (!date) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function getSLAPercentage(deadline: string): number {
  if (!deadline) return 100
  const now = new Date()
  const end = new Date(deadline)
  if (now >= end) return 0
  // Assume SLA window started 72h before deadline
  const start = new Date(end.getTime() - 72 * 60 * 60 * 1000)
  const total = end.getTime() - start.getTime()
  const remaining = end.getTime() - now.getTime()
  return Math.max(0, Math.min(100, (remaining / total) * 100))
}

export function getSLAColor(percentage: number): string {
  if (percentage > 50) return 'text-green-600 bg-green-50'
  if (percentage > 25) return 'text-amber-600 bg-amber-50'
  return 'text-red-600 bg-red-50'
}

export const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending_approval: 'bg-amber-100 text-amber-700',
  pending_finance: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  vendor_selected: 'bg-teal-100 text-teal-700',
  rejected: 'bg-red-100 text-red-700',
  blocked: 'bg-red-100 text-red-700',
  synced_to_sap: 'bg-blue-100 text-blue-700',
  po_created: 'bg-purple-100 text-purple-700',
  cancelled: 'bg-gray-100 text-gray-500',
  exhausted: 'bg-orange-100 text-orange-700',
}

export function normalizeLeadingWhitespace(value: string) {
  return value.replace(/^\s+/, '')
}

