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
  internal_review: 'Internal Review',
  pending_vendor_negotiation: 'Vendor Negotiation',
  active: 'Active',
  extended: 'Extended',
  closed: 'Closed',
  terminated: 'Terminated',
  changes_requested: 'Changes Requested',
  held: 'On Hold',
  proposed: 'Proposed',
  accepted: 'Accepted',
  counter_proposed: 'Counter Proposed',
  requested: 'Requested',
  under_review: 'Under Review',
  submitted: 'Submitted',
  matched: 'Matched',
  on_hold: 'On Hold',
  disputed: 'Disputed',
  payment_initiated: 'Payment Initiated',
  paid: 'Paid',
  never: 'Never Synced',
  success: 'Success',
  failed: 'Failed',
  in_progress: 'In Progress',
  pending: 'Pending',
  passed: 'Passed',
  warning: 'Warning',
  failed_validation: 'Failed',
  skipped: 'Skipped',
  // PO statuses
  issued: 'Issued',
  sent_to_vendor: 'Sent to Vendor',
  acknowledged: 'Acknowledged',
  partially_received: 'Partially Received',
  fully_received: 'Fully Received',
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
  internal_review: 'bg-indigo-500',
  pending_vendor_negotiation: 'bg-cyan-500',
  active: 'bg-green-600',
  extended: 'bg-teal-600',
  closed: 'bg-gray-500',
  terminated: 'bg-red-600',
  changes_requested: 'bg-amber-500',
  held: 'bg-amber-500',
  accepted: 'bg-green-500',
  proposed: 'bg-cyan-500',
  counter_proposed: 'bg-indigo-500',
  requested: 'bg-amber-500',
  under_review: 'bg-blue-500',
  submitted: 'bg-blue-400',
  matched: 'bg-teal-500',
  on_hold: 'bg-amber-600',
  disputed: 'bg-orange-500',
  payment_initiated: 'bg-indigo-500',
  paid: 'bg-green-600',
  pending: 'bg-amber-500',
  in_progress: 'bg-blue-500',
  success: 'bg-green-500',
  failed: 'bg-red-500',
  // PO statuses
  issued: 'bg-blue-500',
  sent_to_vendor: 'bg-indigo-500',
  acknowledged: 'bg-cyan-500',
  partially_received: 'bg-amber-500',
  fully_received: 'bg-green-500',
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
