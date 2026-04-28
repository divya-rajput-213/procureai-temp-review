export type Suggestion = {
    master_item_id: number
    code: string
    description: string
    unit_of_measure: string
    unit_rate?: number
    hsn_code?: string
    category?: string | null
}

export type LineItem = {
    id: number
    quotationId: number
    name: string
    code: string
    uom: string
    hasMatch: boolean
    masterItemId: number | null
    suggestions: Suggestion[]
    selectedMasterId: string | null
    createNew?: boolean
    item_price: number
    quantity?: number
    isNew?: boolean
    isDuplicate?: boolean
}

export type ExtractedVendor = {
    id: string

    // Basic info
    name: string
    company_name?: string

    // Contact
    contactName?: string
    contactEmail?: string
    contactPhone?: string

    // Address
    address?: string
    city?: string
    state?: string
    pincode?: string
    country?: string | null

    // Tax
    gstNumber?: string | null
    panNumber?: string | null

    // Bank
    bank_account?: string
    bank_ifsc?: string
    bank_name?: string

    // Meta
    vendorCreated?: boolean
    is_new?: boolean
}
