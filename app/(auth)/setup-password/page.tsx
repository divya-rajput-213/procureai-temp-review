'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Building2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/lib/stores/auth.store'
import { setupPassword } from '@/lib/api/auth'

const schema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  confirm_password: z.string(),
}).refine((d) => d.password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
})

type FormData = z.infer<typeof schema>

export default function SetupPasswordPage() {
  const router = useRouter()
  const params = useSearchParams()
  const token = params.get('token') || ''
  const { toast } = useToast()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    if (!token) {
      toast({ title: 'Invalid link', description: 'No token found in the URL.', variant: 'destructive' })
      return
    }
    setLoading(true)
    try {
      const resp = await setupPassword({ token, ...data })
      setTokens(resp.access, resp.refresh, resp.user)
      setSuccess(true)
      setTimeout(() => router.push('/dashboard'), 2000)
    } catch (err: any) {
      toast({
        title: 'Setup failed',
        description: err?.response?.data?.error || 'Invalid or expired token.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              {success ? (
                <CheckCircle className="w-8 h-8 text-white" />
              ) : (
                <Building2 className="w-8 h-8 text-white" />
              )}
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">
            {success ? 'Password Set!' : 'Set Up Your Password'}
          </CardTitle>
          <CardDescription>
            {success
              ? 'You are now logged in. Redirecting to dashboard...'
              : 'Create a secure password for your ProcureAI account.'}
          </CardDescription>
        </CardHeader>

        {!success && (
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 chars, 1 uppercase, 1 number"
                  {...register('password')}
                />
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm_password">Confirm Password</Label>
                <Input
                  id="confirm_password"
                  type="password"
                  placeholder="Repeat your password"
                  {...register('confirm_password')}
                />
                {errors.confirm_password && (
                  <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Set Password & Sign In
              </Button>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
