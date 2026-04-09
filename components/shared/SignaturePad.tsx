'use client'

import { useRef, useEffect, useState } from 'react'
import SignaturePadLib from 'signature_pad'
import { Button } from '@/components/ui/button'
import { Eraser } from 'lucide-react'

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string) => void
  width?: number
  height?: number
}

export function SignaturePad({ onSignatureChange, width = 400, height = 150 }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePadLib | null>(null)
  const [isEmpty, setIsEmpty] = useState(true)

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    canvas.width = width
    canvas.height = height

    const pad = new SignaturePadLib(canvas, {
      backgroundColor: 'rgb(255, 255, 255)',
      penColor: 'rgb(0, 0, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    })

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty())
      if (!pad.isEmpty()) {
        onSignatureChange(pad.toDataURL('image/png'))
      }
    })

    padRef.current = pad

    return () => {
      pad.off()
    }
  }, [width, height, onSignatureChange])

  const handleClear = () => {
    if (padRef.current) {
      padRef.current.clear()
      setIsEmpty(true)
      onSignatureChange('')
    }
  }

  return (
    <div className="space-y-2">
      <div className="border-2 border-dashed border-slate-300 rounded-lg overflow-hidden bg-white"
        style={{ width, height }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">
          {isEmpty ? 'Draw your signature above using mouse or touch' : 'Signature captured'}
        </p>
        <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] gap-1"
          onClick={handleClear} disabled={isEmpty}>
          <Eraser className="w-3 h-3" /> Clear
        </Button>
      </div>
    </div>
  )
}
