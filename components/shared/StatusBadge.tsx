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

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium',
        STATUS_COLORS[status] || 'bg-gray-100 text-gray-600',
        className
      )}
    >
      {STATUS_LABELS[status] || status}
    </span>
  )
}
