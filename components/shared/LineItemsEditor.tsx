'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Check, X, Plus } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

export type LineItem = {
  id: string
  item_name: string
  description: string
  qty: string
  uom: string
  unit_rate: string
}

export function newLineItem(): LineItem {
  return {
    id: crypto.randomUUID(),
    item_name: '',
    description: '',
    qty: '1',
    uom: 'Nos',
    unit_rate: '0',
  }
}

export function toApiLineItems(items: LineItem[]) {
  return items.map(({ id, ...rest }) => ({
    ...rest,
    qty: Number(rest.qty) || 0,
    unit_rate: Number(rest.unit_rate) || 0,
  }))
}

export function fromApiLineItems(items: any[]): LineItem[] {
  return (items ?? []).map(i => ({
    ...i,
    id: i.id ?? crypto.randomUUID(),
    qty: String(i.qty ?? ''),
    unit_rate: String(i.unit_rate ?? ''),
  }))
}

// ─── Read-only table ─────────────────────────────────────────────────────────

export function LineItemsTable({ items }: { items: any[] }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground italic py-2">No items added.</p>
  }

  const grandTotal = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_rate) || 0),
    0,
  )

  return (
    <div className="border rounded-md overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 border-b">
          <tr className="text-xs text-muted-foreground">
            <th className="text-left px-3 py-2 font-medium w-8">#</th>
            <th className="text-left px-3 py-2 font-medium">Item / Description</th>
            <th className="text-right px-3 py-2 font-medium w-20">Qty</th>
            <th className="text-left px-3 py-2 font-medium w-20">UOM</th>
            <th className="text-right px-3 py-2 font-medium w-32">Unit Rate</th>
            <th className="text-right px-3 py-2 font-medium w-32">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((item, idx) => {
            const total = (Number(item.qty) || 0) * (Number(item.unit_rate) || 0)
            return (
              <tr key={idx} className="hover:bg-slate-50/50">
                <td className="px-3 py-2.5 text-muted-foreground">{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <span className="font-medium">{item.item_name || '—'}</span>
                  {item.description && (
                    <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right">{item.qty ?? '—'}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{item.uom || '—'}</td>
                <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate)}</td>
                <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(total)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 border-t">
            <td colSpan={5} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
              Total Estimated
            </td>
            <td className="px-3 py-2 text-right font-bold">{formatCurrency(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ─── Editable table ───────────────────────────────────────────────────────────

export function LineItemsEditor({
  items,
  onChange,
}: {
  items: LineItem[]
  onChange: (items: LineItem[]) => void
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<LineItem | null>(null)

  const addItem = () => {
    const item = newLineItem()
    onChange([...items, item])
    setEditingId(item.id)
    setEditForm(item)
  }

  const startEdit = (item: LineItem) => {
    setEditingId(item.id)
    setEditForm({ ...item })
  }

  const saveEdit = () => {
    if (!editForm) return
    onChange(items.map(i => (i.id === editForm.id ? editForm : i)))
    setEditingId(null)
    setEditForm(null)
  }

  const cancelEdit = () => {
    // Remove empty newly-added row on cancel
    if (editForm && !editForm.item_name) {
      onChange(items.filter(i => i.id !== editForm.id))
    }
    setEditingId(null)
    setEditForm(null)
  }

  const deleteItem = (id: string) => {
    if (editingId === id) { setEditingId(null); setEditForm(null) }
    onChange(items.filter(i => i.id !== id))
  }

  const setF = (k: keyof LineItem, v: string) => {
    if (!editForm) return
    setEditForm({ ...editForm, [k]: v })
  }

  const grandTotal = items.reduce(
    (s, i) => s + (Number(i.qty) || 0) * (Number(i.unit_rate) || 0),
    0,
  )

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr className="text-xs text-muted-foreground">
              <th className="text-left px-3 py-2 font-medium w-8">#</th>
              <th className="text-left px-3 py-2 font-medium">Item Name</th>
              <th className="text-left px-3 py-2 font-medium">Description</th>
              <th className="text-right px-2 py-2 font-medium w-20">Qty</th>
              <th className="text-left px-2 py-2 font-medium w-20">UOM</th>
              <th className="text-right px-2 py-2 font-medium w-28">Unit Rate</th>
              <th className="text-right px-3 py-2 font-medium w-28">Amount</th>
              <th className="px-2 py-2 w-16" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-sm text-muted-foreground italic">
                  No items yet. Click + Add Item below.
                </td>
              </tr>
            )}

            {items.map((item, idx) => {
              if (editingId === item.id && editForm) {
                const editTotal = (Number(editForm.qty) || 0) * (Number(editForm.unit_rate) || 0)
                return (
                  <tr key={item.id} className="bg-primary/5">
                    <td className="px-3 py-1.5 text-muted-foreground text-xs">{idx + 1}</td>
                    <td className="px-1 py-1.5">
                      <Input
                        value={editForm.item_name}
                        onChange={e => setF('item_name', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Item name *"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        value={editForm.description}
                        onChange={e => setF('description', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Optional"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        value={editForm.qty}
                        onChange={e => setF('qty', e.target.value)}
                        className="h-7 text-xs text-right"
                        min="0"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        value={editForm.uom}
                        onChange={e => setF('uom', e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Nos"
                      />
                    </td>
                    <td className="px-1 py-1.5">
                      <Input
                        type="number"
                        value={editForm.unit_rate}
                        onChange={e => setF('unit_rate', e.target.value)}
                        className="h-7 text-xs text-right"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right text-xs font-medium">
                      {formatCurrency(editTotal)}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={saveEdit}
                          className="text-green-600 hover:text-green-700 p-0.5 rounded hover:bg-green-50"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }

              const rowTotal = (Number(item.qty) || 0) * (Number(item.unit_rate) || 0)
              return (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium">{item.item_name || '—'}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.description || '—'}</td>
                  <td className="px-3 py-2.5 text-right">{item.qty}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{item.uom}</td>
                  <td className="px-3 py-2.5 text-right">{formatCurrency(item.unit_rate)}</td>
                  <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(rowTotal)}</td>
                  <td className="px-2 py-2">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(item)}
                        className="text-slate-400 hover:text-slate-600 p-0.5 rounded hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteItem(item.id)}
                        className="text-slate-400 hover:text-red-600 p-0.5 rounded hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>

          {items.length > 0 && (
            <tfoot>
              <tr className="bg-slate-50 border-t">
                <td colSpan={6} className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">
                  Total Estimated
                </td>
                <td className="px-3 py-2 text-right font-bold">{formatCurrency(grandTotal)}</td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <Button type="button" variant="outline" size="sm" onClick={addItem} className="gap-1.5 h-7 text-xs">
        <Plus className="w-3.5 h-3.5" /> Add Item
      </Button>
    </div>
  )
}
