import { create } from 'zustand'
import apiClient from '@/lib/api/client'

export interface TaxComponent {
  id: number
  name: string
  rate: number
  description: string
  is_active: boolean
  created_at: string
}

export interface SiteSettings {
  currencyCode: string
  currencySymbol: string
  taxComponents: TaxComponent[]
  isLoaded: boolean
}

interface SettingsStore extends SiteSettings {
  fetch: () => Promise<void>
  updateCurrency: (data: { currencyCode: string; currencySymbol: string }) => Promise<void>
  addTax: (data: { name: string; rate: number; description: string; is_active: boolean }) => Promise<TaxComponent>
  updateTax: (id: number, data: Partial<{ name: string; rate: number; description: string; is_active: boolean }>) => Promise<void>
  deleteTax: (id: number) => Promise<void>
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  currencyCode: 'INR',
  currencySymbol: '₹',
  taxComponents: [],
  isLoaded: false,

  fetch: async () => {
    try {
      const res = await apiClient.get('/core/settings/')
      const d = res.data
      set({
        currencyCode: d.currency_code,
        currencySymbol: d.currency_symbol,
        taxComponents: (d.tax_components ?? []).map((t: any) => ({
          ...t,
          rate: Number(t.rate),
        })),
        isLoaded: true,
      })
    } catch {
      set({ isLoaded: true })
    }
  },

  updateCurrency: async ({ currencyCode, currencySymbol }) => {
    const res = await apiClient.patch('/core/settings/', {
      currency_code: currencyCode,
      currency_symbol: currencySymbol,
    })
    const d = res.data
    set({
      currencyCode: d.currency_code,
      currencySymbol: d.currency_symbol,
    })
  },

  addTax: async (data) => {
    const res = await apiClient.post('/core/tax-components/', {
      name: data.name,
      rate: data.rate,
      description: data.description,
      is_active: data.is_active,
    })
    const newTax: TaxComponent = { ...res.data, rate: Number(res.data.rate) }
    set(s => ({ taxComponents: [...s.taxComponents, newTax] }))
    return newTax
  },

  updateTax: async (id, data) => {
    const res = await apiClient.patch(`/core/tax-components/${id}/`, data)
    const updated: TaxComponent = { ...res.data, rate: Number(res.data.rate) }
    set(s => ({
      taxComponents: s.taxComponents.map(t => (t.id === id ? updated : t)),
    }))
  },

  deleteTax: async (id) => {
    await apiClient.delete(`/core/tax-components/${id}/`)
    set(s => ({ taxComponents: s.taxComponents.filter(t => t.id !== id) }))
  },
}))
