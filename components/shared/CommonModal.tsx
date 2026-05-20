'use client'

import { Button } from '@/components/ui/button'
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
