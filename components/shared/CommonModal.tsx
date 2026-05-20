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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {cancelText}
          </Button>
          <Button
            variant={confirmVariant}
            size="sm"
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
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={title}
      description={description}
      confirmText={confirmText}
      cancelText={cancelText}
      confirmVariant="destructive"
    />
  )
}