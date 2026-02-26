'use client'

import { useQuery } from '@tanstack/react-query'
import { ShoppingCart, Building2, CheckSquare, FileText, TrendingUp, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import apiClient from '@/lib/api/client'

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string
  value: string | number
  subtitle: string
  icon: any
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          </div>
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: async () => {
      const { data } = await apiClient.get('/approvals/requests/pending-mine/')
      return data as any[]
    },
  })

  const { data: recentPRs } = useQuery({
    queryKey: ['recent-prs'],
    queryFn: async () => {
      const { data } = await apiClient.get('/procurement/?ordering=-created_at&page_size=5')
      return data.results || data
    },
  })

  const pendingCount = pendingApprovals?.length || 0

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Pending Approvals"
          value={pendingCount}
          subtitle="Awaiting your action"
          icon={CheckSquare}
          color="bg-amber-500"
        />
        <StatCard
          title="Active PRs"
          value={recentPRs?.length || '—'}
          subtitle="This period"
          icon={ShoppingCart}
          color="bg-blue-600"
        />
        <StatCard
          title="Vendors"
          value="—"
          subtitle="Approved vendors"
          icon={Building2}
          color="bg-green-600"
        />
        <StatCard
          title="Budget Utilised"
          value="—"
          subtitle="vs. approved budget"
          icon={TrendingUp}
          color="bg-purple-600"
        />
      </div>

      {/* Pending Approvals Alert */}
      {pendingCount > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                You have {pendingCount} item{pendingCount !== 1 ? 's' : ''} awaiting your approval.
              </p>
              <a href="/approvals" className="text-xs text-amber-700 underline">
                View approvals →
              </a>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent PRs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Purchase Requisitions</CardTitle>
          <CardDescription>Latest PR activity across all departments</CardDescription>
        </CardHeader>
        <CardContent>
          {!recentPRs || recentPRs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No purchase requisitions found.</p>
          ) : (
            <div className="divide-y">
              {recentPRs.slice(0, 8).map((pr: any) => (
                <div key={pr.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{pr.pr_number}</span>
                      <Badge variant={pr.purchase_type === 'CAPEX' ? 'info' : 'secondary'} className="text-xs">
                        {pr.purchase_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {pr.vendor_name} · {pr.plant_name}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{formatCurrency(pr.total_amount)}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(pr.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
