import { LineItem, Suggestion } from "./types"


function toNumber(value: unknown): number | null {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
}

function getQuotationId(response: any): number | null {
    return (
        toNumber(response?.quotation_id) ??
        toNumber(response?.quotation?.id) ??
        toNumber(response?.id)
    )
}

function getMasterItemId(item: any): number | null {
    return (
        toNumber(item?.master_item_id) ??
        toNumber(item?.master_item?.id) ??
        toNumber(item?.matched_item_id) ??
        toNumber(item?.matched_item?.id) ??
        toNumber(item?.match?.id)
    )
}
export function mapLineItemsFromQuotationResponse(response: any): LineItem[] {
    const quotationId = getQuotationId(response)
    if (!quotationId) return []

    const items = Array.isArray(response?.items) ? response.items : []

    return items
        .map((item: any, index: number) => {
            const itemId =
                toNumber(item?.quotation_item_id) ??
                toNumber(item?.id) ??
                toNumber(item?.item_id)
            if (!itemId) return null

            const suggestions: Suggestion[] = Array.isArray(item?.suggestions)
                ? item.suggestions
                : []

            const masterItemId =
                suggestions.length > 0
                    ? toNumber(suggestions[0].master_item_id)
                    : getMasterItemId(item)

            const hasMatch = Boolean(
                item?.master_item_matched ??
                item?.has_match ??
                item?.matched ??
                item?.is_matched ??
                suggestions.length > 0
            )

            return {
                id: itemId,
                quotationId,
                name: item?.item_name ?? item?.name ?? item?.description ?? `Item ${index + 1}`,
                code: item?.item_code ?? item?.code ?? 'No code',
                uom: item?.unit_of_measure ?? item?.uom ?? item?.unit ?? '—',
                hasMatch,
                masterItemId,
                suggestions,
                selectedMasterId: hasMatch ? String(suggestions[0].master_item_id) : 'ITEM - 123456789',
                createNew: false,
                item_price: toNumber(item?.item_price) ?? 0,
                quantity: toNumber(item?.quantity) ?? 1,
                isNew: item?.is_new ?? false,
                isDuplicate: item?.is_duplicate ?? false,
            }
        })
        .filter((item: LineItem | null): item is LineItem => item !== null)
}