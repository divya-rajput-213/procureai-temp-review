'use client'

import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'
import apiClient from '@/lib/api/client'

const COLORS = ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']

export default function ReportsPage() {
  const { data: prs } = useQuery({
    queryKey: ['all-prs-report'],
    queryFn: async () => (await apiClient.get('/procurement/?page_size=100')).data.results || [],
  })

  const { data: vendors } = useQuery({
    queryKey: ['all-vendors-report'],
    queryFn: async () => (await apiClient.get('/vendors/?page_size=100')).data.results || [],
  })

  // Compute status distribution
  const prByStatus: Record<string, number> = {}
  ;(prs || []).forEach((pr: any) => {
    prByStatus[pr.status] = (prByStatus[pr.status] || 0) + 1
  })
  const prStatusData = Object.entries(prByStatus).map(([name, value]) => ({ name, value }))

  const vendorByStatus: Record<string, number> = {}
  ;(vendors || []).forEach((v: any) => {
    vendorByStatus[v.status] = (vendorByStatus[v.status] || 0) + 1
  })
  const vendorStatusData = Object.entries(vendorByStatus).map(([name, value]) => ({ name, value }))

  // PR total by type
  const prByType = {
    CAPEX: (prs || []).filter((pr: any) => pr.purchase_type === 'CAPEX').reduce((s: number, pr: any) => s + parseFloat(pr.total_amount || 0), 0),
    OPEX: (prs || []).filter((pr: any) => pr.purchase_type === 'OPEX').reduce((s: number, pr: any) => s + parseFloat(pr.total_amount || 0), 0),
  }

  const typeData = [
    { name: 'CAPEX', amount: prByType.CAPEX },
    { name: 'OPEX', amount: prByType.OPEX },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total PRs', value: prs?.length || 0 },
          { label: 'Total Vendors', value: vendors?.length || 0 },
          {
            label: 'Total PR Value',
            value: formatCurrency((prs || []).reduce((s: number, pr: any) => s + parseFloat(pr.total_amount || 0), 0)),
          },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="text-2xl font-bold mt-1">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
       
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">PR Status Distribution</CardTitle>
            <CardDescription>Current status of all purchase requisitions</CardDescription>
          </CardHeader>
          <CardContent>
            {prStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={prStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {prStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Vendor Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {vendorStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={vendorStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {vendorStatusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[220px] text-muted-foreground text-sm">No data</div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
