'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Input } from '@/components/ui/input'

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''

interface AddressResult {
  address: string
  city: string
  state: string
  country: string
  pincode: string
}

interface AddressAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onSelect: (result: AddressResult) => void
  placeholder?: string
  className?: string
}

let scriptLoaded = false
let scriptLoading = false
const loadCallbacks: (() => void)[] = []

function loadGoogleMapsScript(): Promise<void> {
  if (!GOOGLE_MAPS_API_KEY) return Promise.resolve()
  if (scriptLoaded) return Promise.resolve()
  if (scriptLoading) {
    return new Promise(resolve => { loadCallbacks.push(resolve) })
  }
  scriptLoading = true
  return new Promise(resolve => {
    loadCallbacks.push(resolve)
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places`
    script.async = true
    script.onload = () => {
      scriptLoaded = true
      scriptLoading = false
      loadCallbacks.forEach(cb => cb())
      loadCallbacks.length = 0
    }
    script.onerror = () => {
      scriptLoading = false
      loadCallbacks.forEach(cb => cb())
      loadCallbacks.length = 0
    }
    document.head.appendChild(script)
  })
}

function extractAddressComponents(place: google.maps.places.PlaceResult): AddressResult {
  const components = place.address_components ?? []
  const get = (type: string) => components.find(c => c.types.includes(type))?.long_name ?? ''
  const getShort = (type: string) => components.find(c => c.types.includes(type))?.short_name ?? ''

  const streetNumber = get('street_number')
  const route = get('route')
  const sublocality = get('sublocality_level_1') || get('sublocality')
  const premise = get('premise')

  const addressParts = [premise, streetNumber, route, sublocality].filter(Boolean)
  const address = addressParts.join(', ') || place.formatted_address?.split(',').slice(0, -3).join(',').trim() || ''

  return {
    address,
    city: get('locality') || get('administrative_area_level_2'),
    state: get('administrative_area_level_1'),
    country: get('country'),
    pincode: get('postal_code'),
  }
}

export function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) return
    loadGoogleMapsScript().then(() => setReady(true))
  }, [])

  const handlePlaceChanged = useCallback(() => {
    const place = autocompleteRef.current?.getPlace()
    if (!place?.address_components) return
    const result = extractAddressComponents(place)
    onChange(result.address)
    onSelect(result)
  }, [onChange, onSelect])

  useEffect(() => {
    if (!ready || !inputRef.current || autocompleteRef.current) return
    if (!window.google?.maps?.places) return

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['address_components', 'formatted_address'],
    })

    autocompleteRef.current.addListener('place_changed', handlePlaceChanged)
  }, [ready, handlePlaceChanged])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={className}
      />
    )
  }

  return (
    <Input
      ref={inputRef}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder ?? 'Start typing an address…'}
      className={className}
    />
  )
}
