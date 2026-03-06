'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { useAuthStore } from '@/lib/stores/auth.store'
import { login, azureCallback } from '@/lib/api/auth'
import { PublicClientApplication, Configuration } from '@azure/msal-browser'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof loginSchema>

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri: typeof window !== 'undefined' ? window.location.origin : '',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const setTokens = useAuthStore((s) => s.setTokens)
  const [loading, setLoading] = useState(false)
  const [azureLoading, setAzureLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const resp = await login(data)
      setTokens(resp.access, resp.refresh, resp.user, resp.company)
      router.push('/dashboard')
    } catch (err: any) {
      toast({
        title: 'Login failed',
        description: err?.response?.data?.error || 'Invalid credentials.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAzureLogin = async () => {
    if (!process.env.NEXT_PUBLIC_AZURE_CLIENT_ID) {
      toast({ title: 'Azure SSO not configured', variant: 'destructive' })
      return
    }
    setAzureLoading(true)
    try {
      const msalInstance = new PublicClientApplication(msalConfig)
      await msalInstance.initialize()
      const result = await msalInstance.loginPopup({
        scopes: ['openid', 'profile', 'email', 'User.Read'],
      })
      const resp = await azureCallback(result.accessToken)
      setTokens(resp.access, resp.refresh, resp.user, resp.company)
      router.push('/dashboard')
    } catch (err: any) {
      toast({
        title: 'Azure login failed',
        description: err?.response?.data?.error || err?.message || 'Authentication failed.',
        variant: 'destructive',
      })
    } finally {
      setAzureLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-primary rounded-xl flex items-center justify-center">
              <Building2 className="w-8 h-8 text-white" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">ProcureAI</CardTitle>
          <CardDescription>Sign in to access the platform</CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Azure SSO Button */}
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center gap-2"
            onClick={handleAzureLogin}
            disabled={azureLoading}
          >
            {azureLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M11.4 24H0V12.6L11.4 24zM12.6 24H24V12.6L12.6 24zM0 11.4V0h11.4L0 11.4zM12.6 0H24v11.4L12.6 0z" />
              </svg>
            )}
            Sign in with Microsoft
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or sign in with email</span>
            </div>
          </div>

          {/* Email + Password Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                {...register('email')}
                aria-invalid={!!errors.email}
              />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...register('password')}
                aria-invalid={!!errors.password}
              />
              {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
          </form>

          <p className="text-xs text-center text-muted-foreground">
            Contact your administrator for access.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
