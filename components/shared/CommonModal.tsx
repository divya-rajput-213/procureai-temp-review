'use client'

import { Button } from '@/components/ui/button'
import { Loader2, X } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type ButtonVariant = 'destructive' | 'default' | 'outline' | 'secondary' | 'ghost' | 'link'

type ConfirmDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  confirmVariant?: ButtonVariant
}

export function ConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Confirm Action',
  description = 'Are you sure you want to proceed?',
  confirmText = 'Yes, Submit',
  cancelText = 'Cancel',
  confirmVariant = 'default',
}: Readonly<ConfirmDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 overflow-hidden rounded-md">
        <DialogHeader className="p-5 space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="p-4 border-t flex-row justify-end gap-4">
          <Button
            variant="ghost"
            className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            className="bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteDialog({
  open,
  onOpenChange,
  onConfirm,
  title = 'Delete Item',
  description = 'Are you sure you want to delete this item?',
  confirmText = 'Delete',
  cancelText = 'Cancel',
}: Readonly<Omit<ConfirmDialogProps, 'confirmVariant'>>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[520px] p-0 gap-0 overflow-hidden rounded-md">
        <DialogHeader className="px-8 pt-7 pb-6 space-y-2">
          <DialogTitle className="text-xl font-semibold tracking-tight">{title}</DialogTitle>
          <DialogDescription className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="px-8 py-5 border-t flex-row justify-end gap-4">
          <Button
            variant="ghost"
            className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            {cancelText}
          </Button>
          <Button
            className="bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold"
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DeleteConfirmModal({ name, onClose, onConfirm, isPending }: Readonly<{
  name: string; onClose: () => void; onConfirm: () => void; isPending: boolean
}>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-md shadow-xl w-full max-w-[520px] p-0 overflow-hidden">
        <div className="p-5 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight pr-10">Delete Quotation</h2>
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
            <div>By deleting the quotation <span className="font-semibold text-slate-900">{name}</span>, this action cannot be undone.</div>
            <div>Are you sure you want to delete it?</div>
          </div>
        </div>
        <div className="border-t px-5 py-3 flex items-center justify-end gap-4">
          <Button variant="ghost" className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={isPending} onClick={onConfirm} className="gap-2 bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold">
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Delete
          </Button>
        </div>
      </div>
    </div>
  )
}

export function ConfirmModal({ open, onOpenChange, onConfirm, title, description, confirmText, isPending }: Readonly<{
  open: boolean; onOpenChange: (v: boolean) => void; onConfirm: () => void
  title: string; description: string; confirmText: string; isPending?: boolean
}>) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-md shadow-xl w-full max-w-[520px] p-0 overflow-hidden">
        <div className="p-5 space-y-3">
          <h2 className="text-xl font-semibold tracking-tight pr-10">{title}</h2>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-sm text-slate-500 hover:text-slate-700 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="mt-2 text-sm text-slate-700 leading-relaxed">
            <div>{description}</div>
          </div>
        </div>
        <div className="border-t px-5 py-3 flex items-center justify-end gap-4">
          <Button
            variant="ghost"
            className="px-2 text-[#042348] hover:text-[#032B5C] hover:bg-transparent"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={isPending}
            onClick={onConfirm}
            className="gap-2 bg-[#042348] text-white hover:bg-[#032B5C] shadow-md rounded-md px-6 font-semibold"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}