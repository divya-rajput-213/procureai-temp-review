import { cn, STATUS_COLORS } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  pending_finance: 'Pending Finance',
  approved: 'Approved',
  rejected: 'Rejected',
  blocked: 'Blocked',
  vendor_selected: 'Vendor Selected',
  synced_to_sap: 'Synced to SAP',
  po_created: 'PO Created',
  cancelled: 'Cancelled',
  exhausted: 'Budget Exhausted',
  never: 'Never Synced',
  success: 'Success',
  failed: 'Failed',
  in_progress: 'In Progress',
  pending: 'Pending',
  passed: 'Passed',
  warning: 'Warning',
  failed_validation: 'Failed',
  skipped: 'Skipped',
}

const DOT_COLORS: Record<string, string> = {
  draft: 'bg-gray-400',
  pending_approval: 'bg-amber-500',
  pending_finance: 'bg-amber-500',
  approved: 'bg-green-500',
  vendor_selected: 'bg-teal-500',
  rejected: 'bg-red-500',
  blocked: 'bg-red-500',
  synced_to_sap: 'bg-blue-500',
  po_created: 'bg-purple-500',
  cancelled: 'bg-gray-400',
  exhausted: 'bg-orange-500',
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-600',
        className
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', DOT_COLORS[status] || 'bg-gray-400')} />
      {STATUS_LABELS[status] || status}
    </span>
  )
}
