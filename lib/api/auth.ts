import apiClient from './client'

export interface LoginCredentials {
  email: string
  password: string
}

export interface AuthResponse {
  access: string
  refresh: string
  user: User
  company?: {
    id: number
    name: string
    schema_name: string
  }
}

export interface User {
  id: number
  hash_id: string
  email: string
  first_name: string
  last_name: string
  full_name: string
  account_type: 'azure_ad' | 'local' | 'vendor'
  roles: Role[]
  company: number | null
  company_name: string | null
  plant: number | null
  plant_name: string | null
  department: number | null
  department_name: string | null
  designation: string
  is_active: boolean
}

export interface Role {
  id: number
  name: string
  display_name: string
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/login/', credentials)
  return data
}

export async function azureCallback(azure_token: string): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/auth/azure-callback/', { azure_token })
  return data
}

export async function setupPassword(payload: {
  token: string
  password: string
  confirm_password: string
}): Promise<AuthResponse> {
  const { data } = await apiClient.post<AuthResponse>('/users/setup-password/', payload)
  return data
}
