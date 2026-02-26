'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/components/ui/use-toast'
import {
  Plus, Search, UserCheck, UserX, RefreshCw, Loader2,
  CheckCircle, XCircle, AlertCircle, Eye, EyeOff, Shield, Trash2, Pencil, X,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import apiClient from '@/lib/api/client'

export default function UsersPage() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'users' | 'azure' | 'import' | 'roles'>('users')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showClientSecret, setShowClientSecret] = useState(false)
  const [addForm, setAddForm] = useState({ first_name: '', last_name: '', email: '', designation: '', phone: '', role_ids: [] as number[] })

  // Edit user state
  const [editUser, setEditUser] = useState<any | null>(null)
  const [editForm, setEditForm] = useState({ first_name: '', last_name: '', designation: '', role_ids: [] as number[] })
  const [editRoleSearch, setEditRoleSearch] = useState('')
  const [showEditRoleDropdown, setShowEditRoleDropdown] = useState(false)

  // Roles tab state
  const [selectedRole, setSelectedRole] = useState<any | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [assignSearch, setAssignSearch] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', search, roleFilter],
    queryFn: async () => {
      const p = new URLSearchParams()
      if (search) p.set('search', search)
      if (roleFilter) p.set('role', roleFilter)
      const { data } = await apiClient.get(`/users/${p.toString() ? '?' + p.toString() : ''}`)
      return Array.isArray(data) ? data : (data.results || [])
    },
  })

  const { data: azureConfig } = useQuery({
    queryKey: ['azure-config'],
    queryFn: async () => (await apiClient.get('/users/azure-config/')).data,
    enabled: activeTab === 'azure',
  })

  const [azureForm, setAzureForm] = useState({ tenant_id: '', client_id: '', client_secret: '' })

  const saveAzureConfigMutation = useMutation({
    mutationFn: async () => apiClient.patch('/users/azure-config/', { ...azureForm, is_active: true }),
    onSuccess: () => {
      toast({ title: 'Azure AD config saved.' })
      queryClient.invalidateQueries({ queryKey: ['azure-config'] })
    },
  })

  const syncAzureMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/users/azure-sync/')).data,
    onSuccess: (data: any) => {
      toast({ title: `Sync complete: +${data.added} added, ${data.updated} updated, ${data.deactivated} deactivated.` })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast({ title: 'Sync failed', variant: 'destructive' }),
  })

  const toggleAddRole = (roleId: number, checked: boolean) => {
    setAddForm(f => ({
      ...f,
      role_ids: checked ? [...f.role_ids, roleId] : f.role_ids.filter(id => id !== roleId),
    }))
  }

  const createUserMutation = useMutation({
    mutationFn: async () => (await apiClient.post('/users/', addForm)).data,
    onSuccess: (data: any) => {
      toast({
        title: 'User created.',
        description: data.email_sent
          ? `Welcome email sent to ${addForm.email}.`
          : `User created but welcome email failed. Check SMTP settings.`,
      })
      setShowAddModal(false)
      setAddForm({ first_name: '', last_name: '', email: '', designation: '', phone: '', role_ids: [] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => toast({ title: 'Failed to create user', description: err?.response?.data?.email?.[0], variant: 'destructive' }),
  })

  const editUserMutation = useMutation({
    mutationFn: async () => apiClient.patch(`/users/${editUser?.id}/`, editForm),
    onSuccess: () => {
      toast({ title: 'User updated.' })
      setEditUser(null)
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: () => toast({ title: 'Failed to update user', variant: 'destructive' }),
  })

  const openEditUser = (u: any) => {
    setEditUser(u)
    setEditForm({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      designation: u.designation || '',
      role_ids: (u.roles || []).map((r: any) => r.id),
    })
    setEditRoleSearch('')
    setShowEditRoleDropdown(false)
  }

  // Bulk import
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importResult, setImportResult] = useState<any>(null)
  const [importing, setImporting] = useState(false)

  const onImportDrop = useCallback((files: File[]) => {
    setImportFile(files[0] || null)
    setImportResult(null)
  }, [])

  const { getRootProps: getImportRootProps, getInputProps: getImportInputProps } = useDropzone({
    onDrop: onImportDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1,
  })

  const runImport = async (dryRun: boolean) => {
    if (!importFile) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const { data } = await apiClient.post(
        `/users/bulk-import/?dry_run=${dryRun}`,
        fd,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )
      setImportResult(data)
      if (!dryRun) {
        toast({ title: `${data.created} users created.` })
        queryClient.invalidateQueries({ queryKey: ['users'] })
      }
    } catch {
      toast({ title: 'Import failed', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }

  // Roles queries & mutation
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const r = await apiClient.get('/users/roles/')
      return r.data.results ?? r.data
    },
  })

  const { data: roleUsers, isLoading: roleUsersLoading } = useQuery({
    queryKey: ['role-users', selectedRole?.name],
    queryFn: async () => {
      const { data } = await apiClient.get(`/users/?role=${encodeURIComponent(selectedRole.name)}`)
      return Array.isArray(data) ? data : (data.results || [])
    },
    enabled: activeTab === 'roles' && !!selectedRole,
  })

  const updateUserRolesMutation = useMutation({
    mutationFn: async ({ userId, roleIds }: { userId: number; roleIds: number[] }) =>
      apiClient.patch(`/users/${userId}/`, { role_ids: roleIds }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-users', selectedRole?.name] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      toast({ title: 'Roles updated.' })
    },
    onError: () => toast({ title: 'Failed to update roles', variant: 'destructive' }),
  })

  const removeRoleFromUser = (user: any) => {
    const newIds = (user.roles || []).filter((r: any) => r.id !== selectedRole?.id).map((r: any) => r.id)
    updateUserRolesMutation.mutate({ userId: user.id, roleIds: newIds })
  }

  const assignRoleToUser = (user: any) => {
    const currentIds = (user.roles || []).map((r: any) => r.id)
    if (currentIds.includes(selectedRole?.id)) return
    updateUserRolesMutation.mutate({ userId: user.id, roleIds: [...currentIds, selectedRole.id] })
    setShowAssignModal(false)
    setAssignSearch('')
  }

  const filteredAssignUsers = (users || []).filter((u: any) => {
    if (!assignSearch) return true
    const q = assignSearch.toLowerCase()
    return (u.full_name || u.email)?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q)
  })

  const totalUsers = users?.length || 0
  const adSynced = users?.filter((u: any) => u.is_ad_synced).length || 0
  const inactive = users?.filter((u: any) => !u.is_active).length || 0

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="border-b flex gap-1">
        {([
          ['users', 'All Users'],
          ['azure', 'Azure AD Sync'],
          ['import', 'Bulk Import'],
          ['roles', 'Roles'],
        ] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px
              ${activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* All Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Total', value: totalUsers, color: 'text-slate-700' },
              { label: 'Azure AD', value: adSynced, color: 'text-blue-600' },
              { label: 'Local', value: totalUsers - adSynced, color: 'text-slate-600' },
              { label: 'Inactive', value: inactive, color: 'text-red-600' },
            ].map(({ label, value, color }) => (
              <Card key={label}>
                <CardContent className="p-4 text-center">
                  <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Search + Filter + Add */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search users..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <select
              className="h-10 border rounded-md px-3 text-sm bg-background"
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
            >
              <option value="">All Roles</option>
              {(roles || []).map((r: any) => (
                <option key={r.id} value={r.name}>{r.display_name}</option>
              ))}
            </select>
            <Button onClick={() => setShowAddModal(true)} className="gap-2 shrink-0">
              <Plus className="w-4 h-4" />
              Add User
            </Button>
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading users...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Roles</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(users || []).map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-primary rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0">
                                {(u.first_name || u.email)?.[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium">{u.full_name || u.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">{u.plant_name || '—'}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {u.roles?.slice(0, 2).map((r: any) => (
                                <Badge key={r.id} variant="secondary" className="text-xs">{r.display_name}</Badge>
                              ))}
                              {u.roles?.length > 2 && <Badge variant="outline" className="text-xs">+{u.roles.length - 2}</Badge>}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={u.account_type === 'azure_ad' ? 'info' : 'secondary'} className="text-xs">
                              {u.account_type === 'azure_ad' ? 'Azure AD' : 'Local'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            {u.is_active ? (
                              <span className="flex items-center gap-1 text-xs text-green-700"><UserCheck className="w-3 h-3" />Active</span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-600"><UserX className="w-3 h-3" />Inactive</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs gap-1"
                              onClick={() => openEditUser(u)}
                            >
                              <Pencil className="w-3 h-3" /> Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Azure AD Sync Tab */}
      {activeTab === 'azure' && (
        <div className="max-w-xl space-y-4">
          <Card>
            <CardHeader><CardTitle>Azure AD Configuration</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {azureConfig?.is_active ? (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-green-700 font-medium">Connected</span>
                  {azureConfig.last_sync_at && (
                    <span className="text-muted-foreground">· Last sync: {formatDateTime(azureConfig.last_sync_at)}</span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span className="text-amber-700">Not configured or inactive</span>
                </div>
              )}

              {[
                { label: 'Tenant ID', key: 'tenant_id', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
                { label: 'Client ID', key: 'client_id', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label>{label}</Label>
                  <Input
                    placeholder={placeholder}
                    defaultValue={azureConfig?.[key] || ''}
                    onChange={(e) => setAzureForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}

              <div className="space-y-1">
                <Label>Client Secret</Label>
                <div className="relative">
                  <Input
                    type={showClientSecret ? 'text' : 'password'}
                    placeholder="Enter client secret..."
                    onChange={(e) => setAzureForm((f) => ({ ...f, client_secret: e.target.value }))}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    onClick={() => setShowClientSecret(!showClientSecret)}
                  >
                    {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                onClick={() => saveAzureConfigMutation.mutate()}
                disabled={saveAzureConfigMutation.isPending}
              >
                Save Configuration
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Sync Users</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {azureConfig?.last_sync_summary && (
                <div className="bg-slate-50 rounded-md p-3 text-sm space-y-1">
                  <p className="font-medium">Last Sync Summary</p>
                  <p>Added: {azureConfig.last_sync_summary.added || 0} · Updated: {azureConfig.last_sync_summary.updated || 0} · Deactivated: {azureConfig.last_sync_summary.deactivated || 0}</p>
                </div>
              )}
              <Button
                onClick={() => syncAzureMutation.mutate()}
                disabled={syncAzureMutation.isPending || !azureConfig?.is_active}
                className="gap-2"
              >
                {syncAzureMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Syncing... (may take up to 30s)
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    Sync Now
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Import Tab */}
      {activeTab === 'import' && (
        <div className="max-w-2xl space-y-4">
          <Card>
            <CardHeader><CardTitle>Bulk Import Users via CSV</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                CSV columns: full_name, email, employee_code, plant_code, department_code, designation, phone, role
              </p>

              <div
                {...getImportRootProps()}
                className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-slate-300 transition-colors"
              >
                <input {...getImportInputProps()} />
                {importFile ? (
                  <p className="text-sm font-medium">{importFile.name}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Drop CSV file here or click to select</p>
                )}
              </div>

              {importFile && !importResult && (
                <Button onClick={() => runImport(true)} disabled={importing} className="gap-2">
                  {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                  Validate CSV
                </Button>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="flex gap-4 text-sm">
                    <span className="flex items-center gap-1 text-green-700">
                      <CheckCircle className="w-4 h-4" />
                      {importResult.valid_rows ?? (importResult.total_rows - importResult.skipped)} valid
                    </span>
                    {importResult.skipped > 0 && (
                      <span className="flex items-center gap-1 text-red-600">
                        <XCircle className="w-4 h-4" />
                        {importResult.skipped} errors
                      </span>
                    )}
                  </div>

                  {importResult.errors?.length > 0 && (
                    <div className="border rounded-md overflow-auto max-h-48">
                      <table className="w-full text-xs">
                        <thead className="bg-red-50 border-b">
                          <tr>
                            <th className="text-left px-3 py-2">Row</th>
                            <th className="text-left px-3 py-2">Field</th>
                            <th className="text-left px-3 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importResult.errors.map((e: any) => (
                            <tr key={`${e.row}-${e.field}`} className="bg-red-50/50">
                              <td className="px-3 py-2">{e.row}</td>
                              <td className="px-3 py-2">{e.field}</td>
                              <td className="px-3 py-2 text-red-700">{e.reason}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {!importResult.created && importResult.valid_rows > 0 && (
                    <Button onClick={() => runImport(false)} disabled={importing} className="gap-2">
                      {importing && <Loader2 className="w-4 h-4 animate-spin" />}
                      Import {importResult.valid_rows} Users
                    </Button>
                  )}

                  {importResult.created > 0 && (
                    <p className="text-sm text-green-700 font-medium">
                      <CheckCircle className="w-4 h-4 inline mr-1" />
                      {importResult.created} users created and welcome emails sent.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Click a role to view and manage its users.
            </p>
            {selectedRole && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowAssignModal(true)}>
                <Plus className="w-3.5 h-3.5" /> Assign User to {selectedRole.display_name}
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(roles || []).map((role: any) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(selectedRole?.id === role.id ? null : role)}
                className={`text-left border-2 rounded-lg p-4 transition-all
                  ${selectedRole?.id === role.id
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300 bg-white'}`}
              >
                <div className="flex items-start gap-2">
                  <Shield className={`w-4 h-4 mt-0.5 shrink-0 ${selectedRole?.id === role.id ? 'text-primary' : 'text-muted-foreground'}`} />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{role.display_name}</p>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{role.name}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {selectedRole && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  {selectedRole.display_name} — Users
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {roleUsersLoading && (
                  <div className="p-6 text-center text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                  </div>
                )}
                {!roleUsersLoading && (roleUsers || []).length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">
                    No users assigned to this role.
                  </div>
                )}
                {!roleUsersLoading && (roleUsers || []).length > 0 && (
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Name</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Email</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Plant</th>
                        <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                        <th className="px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(roleUsers || []).map((u: any) => (
                        <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center text-xs text-white font-bold shrink-0">
                                {(u.first_name || u.email)?.[0]?.toUpperCase()}
                              </div>
                              <span className="font-medium">{u.full_name || u.email}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                          <td className="px-4 py-3">{u.plant_name || '—'}</td>
                          <td className="px-4 py-3">
                            {u.is_active ? (
                              <span className="flex items-center gap-1 text-xs text-green-700"><UserCheck className="w-3 h-3" />Active</span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-600"><UserX className="w-3 h-3" />Inactive</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                              disabled={updateUserRolesMutation.isPending}
                              onClick={() => removeRoleFromUser(u)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" /> Remove
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Assign Role Modal */}
      {showAssignModal && selectedRole && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">
                Assign <span className="text-primary">{selectedRole.display_name}</span> to User
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search users..."
                  value={assignSearch}
                  onChange={(e) => setAssignSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="border rounded-md max-h-60 overflow-y-auto divide-y">
                {filteredAssignUsers.length === 0 ? (
                  <p className="px-3 py-3 text-sm text-muted-foreground">No users found.</p>
                ) : (
                  filteredAssignUsers.slice(0, 20).map((u: any) => {
                    const alreadyHasRole = (u.roles || []).some((r: any) => r.id === selectedRole.id)
                    return (
                      <button
                        key={u.id}
                        type="button"
                        disabled={alreadyHasRole || updateUserRolesMutation.isPending}
                        className="w-full text-left px-3 py-2.5 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-between"
                        onClick={() => assignRoleToUser(u)}
                      >
                        <span>
                          <span className="font-medium">{u.full_name || u.email}</span>
                          <span className="text-muted-foreground ml-2 text-xs">{u.email}</span>
                        </span>
                        {alreadyHasRole && <span className="text-xs text-muted-foreground">Already assigned</span>}
                      </button>
                    )
                  })
                )}
              </div>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => { setShowAssignModal(false); setAssignSearch('') }}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Edit User Modal */}
      {editUser && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="text-base">Edit User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">First Name</Label>
                  <Input
                    value={editForm.first_name}
                    onChange={e => setEditForm(f => ({ ...f, first_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Last Name</Label>
                  <Input
                    value={editForm.last_name}
                    onChange={e => setEditForm(f => ({ ...f, last_name: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Designation</Label>
                <Input
                  value={editForm.designation}
                  onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))}
                />
              </div>

              {/* Roles multi-select */}
              <div className="space-y-1.5">
                <Label className="text-xs">Roles</Label>
                {/* Selected role chips */}
                {editForm.role_ids.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {editForm.role_ids.map(id => {
                      const role = (roles || []).find((r: any) => r.id === id)
                      return role ? (
                        <span key={id} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                          {role.display_name}
                          <button
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => setEditForm(f => ({ ...f, role_ids: f.role_ids.filter(i => i !== id) }))}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ) : null
                    })}
                  </div>
                )}
                {/* Dropdown trigger */}
                <div className="relative">
                  <Input
                    placeholder="Search and add roles..."
                    value={editRoleSearch}
                    onChange={e => { setEditRoleSearch(e.target.value); setShowEditRoleDropdown(true) }}
                    onFocus={() => setShowEditRoleDropdown(true)}
                    onBlur={() => setTimeout(() => setShowEditRoleDropdown(false), 150)}
                    className="text-sm"
                  />
                  {showEditRoleDropdown && (
                    <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border rounded-md shadow-lg max-h-44 overflow-y-auto">
                      {(roles || [])
                        .filter((r: any) =>
                          !editForm.role_ids.includes(r.id) &&
                          (r.display_name.toLowerCase().includes(editRoleSearch.toLowerCase()) || !editRoleSearch)
                        )
                        .map((r: any) => (
                          <button
                            key={r.id}
                            type="button"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => {
                              setEditForm(f => ({ ...f, role_ids: [...f.role_ids, r.id] }))
                              setEditRoleSearch('')
                            }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            {r.display_name}
                          </button>
                        ))}
                      {(roles || []).filter((r: any) =>
                        !editForm.role_ids.includes(r.id) &&
                        (r.display_name.toLowerCase().includes(editRoleSearch.toLowerCase()) || !editRoleSearch)
                      ).length === 0 && (
                        <p className="px-3 py-2 text-sm text-muted-foreground">No more roles available.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditUser(null)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => editUserMutation.mutate()}
                  disabled={editUserMutation.isPending}
                  className="flex-1 gap-2"
                >
                  {editUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add New User</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'First Name *', key: 'first_name', placeholder: 'John' },
                { label: 'Last Name *', key: 'last_name', placeholder: 'Doe' },
                { label: 'Email *', key: 'email', placeholder: 'john@company.com' },
                { label: 'Designation', key: 'designation', placeholder: 'Manager' },
                { label: 'Phone', key: 'phone', placeholder: '+91 98765 43210' },
              ].map(({ label, key, placeholder }) => (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">{label}</Label>
                  <Input
                    placeholder={placeholder}
                    value={addForm[key as keyof typeof addForm] as string}
                    onChange={(e) => setAddForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              {(roles || []).length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Roles</Label>
                  <div className="border rounded-md p-2.5 max-h-36 overflow-y-auto space-y-1.5">
                    {(roles || []).map((r: any) => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 rounded"
                          checked={addForm.role_ids.includes(r.id)}
                          onChange={e => toggleAddRole(r.id, e.target.checked)}
                        />
                        {r.display_name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button
                  onClick={() => createUserMutation.mutate()}
                  disabled={createUserMutation.isPending || !addForm.email || !addForm.first_name}
                  className="flex-1 gap-2"
                >
                  {createUserMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create User
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
