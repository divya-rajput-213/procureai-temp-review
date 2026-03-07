'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Pencil, X, Loader2, Check } from 'lucide-react'
import { useAuthStore } from '@/lib/stores/auth.store'
import { useToast } from '@/components/ui/use-toast'
import apiClient from '@/lib/api/client'

export default function ProfilePage() {
  const { toast } = useToast()
  const user = useAuthStore((s) => s.user)
  const setTokens = useAuthStore((s) => s.setTokens)
  const accessToken = useAuthStore((s) => s.accessToken)
  const refreshToken = useAuthStore((s) => s.refreshToken)

  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    first_name: user?.first_name ?? '',
    last_name: user?.last_name ?? '',
    designation: user?.designation ?? '',
  })

  useEffect(() => {
    setForm({
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      designation: user?.designation ?? '',
    })
  }, [user])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await apiClient.patch(`/users/${user?.hash_id ?? user?.id}/`, {
        first_name: form.first_name,
        last_name: form.last_name,
        designation: form.designation,
      })
      if (accessToken && refreshToken) {
        setTokens(accessToken, refreshToken, { ...user!, ...res.data })
      }
      toast({ title: 'Profile updated.' })
      setIsEditing(false)
    } catch (err: any) {
      toast({ title: 'Update failed', description: err?.response?.data?.error, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setForm({
      first_name: user?.first_name ?? '',
      last_name: user?.last_name ?? '',
      designation: user?.designation ?? '',
    })
    setIsEditing(false)
  }

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase() || 'U'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile header */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-indigo-600 text-white text-xl font-bold flex items-center justify-center shrink-0">
          {initials}
        </div>
        <div>
          <h1 className="text-xl font-semibold">{user?.first_name} {user?.last_name}</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
      </div>

      {/* Account info card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Account Information</CardTitle>
              <CardDescription>Your profile and account details</CardDescription>
            </div>
            {!isEditing && (
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} className="gap-1.5 shrink-0">
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {isEditing ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">First Name</Label>
                  <Input value={form.first_name} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} className="h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input value={form.last_name} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} className="h-8 text-sm" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Designation</Label>
                <Input value={form.designation} onChange={e => setForm(p => ({ ...p, designation: e.target.value }))} className="h-8 text-sm" placeholder="e.g. Purchase Manager" />
              </div>
              <div className="space-y-2 pt-2 border-t text-sm">
                {([
                  ['Email', user?.email],
                  ['Account Type', user?.account_type],
                  ['Plant', user?.plant_name || '—'],
                  ['Department', user?.department_name || '—'],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="font-medium">{value ?? '—'}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={handleCancel} className="gap-1" disabled={saving}>
                  <X className="w-3.5 h-3.5" /> Cancel
                </Button>
                <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1">
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {([
                ['Name', `${user?.first_name} ${user?.last_name}`],
                ['Email', user?.email],
                ['Designation', user?.designation || '—'],
                ['Account Type', user?.account_type],
                ['Plant', user?.plant_name || '—'],
                ['Department', user?.department_name || '—'],
              ] as [string, string | undefined][]).map(([label, value]) => (
                <div key={label} className="flex justify-between border-b pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-medium">{value ?? '—'}</span>
                </div>
              ))}
              <div className="flex justify-between pt-1">
                <span className="text-muted-foreground">Roles</span>
                <div className="flex flex-wrap gap-1 justify-end">
                  {user?.roles?.map((r) => (
                    <Badge key={r.id} variant="secondary" className="text-xs">{r.display_name}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
