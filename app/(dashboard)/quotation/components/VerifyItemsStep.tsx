import React, { useMemo, useState } from 'react'
import {
    Search,
    Download,
    ChevronRight,
    Check,
    Plus,
    X,
    Sparkles,
    ChevronDown,
    Trash2,
    RotateCcw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { cn } from '@/lib/utils'

interface VerifyItemsStepProps {
    file: File | null
    quotation: any
    lineItems: any[]
    setLineItems: React.Dispatch<React.SetStateAction<any[]>>
    masterItems?: any[]
    onContinue?: () => void
    onBack?: () => void
}

const VerifyItemsStep = ({
    file,
    quotation,
    lineItems = [],
    setLineItems,
    masterItems = [],
    onContinue,
    onBack,
}: VerifyItemsStepProps) => {

    const [filter, setFilter] = useState<'all' | 'matched' | 'review' | 'new'>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [mappingSearch, setMappingSearch] = useState('')
    const [isAddingItem, setIsAddingItem] = useState(false)
    const [addItemSearch, setAddItemSearch] = useState('')

    const items = useMemo(() => {
        return lineItems.map((item, originalIndex) => {
            const hasSuggestions = item.suggestions && item.suggestions.length > 0
            const mainSuggestion = hasSuggestions ? item.suggestions[0] : null

            // Determine status based on current state
            let status: 'matched' | 'review' | 'new' = 'review'
            if (item.is_new) {
                status = 'new'
            } else if (item.selectedMasterId || item.master_item_id) {
                status = 'matched'
            } else if (!hasSuggestions) {
                status = 'review' // Needs mapping
            }

            // Current mapped item
            const currentMappedId = item.selectedMasterId || item.master_item_id
            const currentMatch = item.suggestions?.find((s: any) => String(s.master_item_id) === String(currentMappedId)) || mainSuggestion

            const mapping = {
                id: currentMappedId || (mainSuggestion?.master_item_id ?? ''),
                code: currentMatch?.code || '—',
                description: currentMatch?.description || '—',
                confidence: item.is_duplicate ? 100 : 85,
                category: item.category_name || currentMatch?.category || 'General',
                hsn: item.hsn_code || currentMatch?.hsn_code || '—'
            }

            return {
                ...item,
                originalIndex,
                status,
                mapping,
                hasSuggestions
            }
        })
    }, [lineItems])

    const counts = useMemo(() => ({
        all: items.length,
        matched: items.filter(i => i.status === 'matched').length,
        review: items.filter(i => i.status === 'review').length,
        new: items.filter(i => i.status === 'new').length
    }), [items])

    const filteredItems = useMemo(() => {
        let result = items
        if (filter === 'matched') result = items.filter(i => i.status === 'matched')
        if (filter === 'review') result = items.filter(i => i.status === 'review')
        if (filter === 'new') result = items.filter(i => i.status === 'new')

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            result = result.filter(i =>
                i.item_name?.toLowerCase().includes(q) ||
                i.item_code?.toLowerCase().includes(q) ||
                i.hsn_code?.toLowerCase().includes(q)
            )
        }
        return result
    }, [items, filter, searchQuery])

    const previewUrl =
        quotation?.file_url || (file ? URL.createObjectURL(file) : null)

    const handleUpdateMapping = (index: number, suggestion: any) => {
        setLineItems(prev => {
            const updated = [...prev]
            updated[index] = {
                ...updated[index],
                selectedMasterId: String(suggestion.master_item_id),
                is_new: false,
                item_code: suggestion.code,
                item_name: suggestion.description,
                hsn_code: suggestion.hsn_code,
                category_name: suggestion.category
            }
            return updated
        })
    }

    const handleSetAsNew = (index: number, shouldBeNew: boolean) => {
        setLineItems(prev => {
            const updated = [...prev]
            updated[index] = {
                ...updated[index],
                is_new: shouldBeNew,
                selectedMasterId: shouldBeNew ? '' : (updated[index].suggestions?.[0]?.master_item_id ?? '')
            }
            return updated
        })
    }

    const handleDeleteItem = (index: number) => {
        setLineItems(prev => prev.filter((_, i) => i !== index))
    }

    const addItemFromCatalog = (catalogItem: any) => {
        const masterItemId = String(catalogItem.hash_id || catalogItem.id || '')
        const newItem = {
            item_name: catalogItem.description || 'New item',
            item_code: catalogItem.code || '',
            item_price: Number(catalogItem.unit_rate ?? catalogItem.item_price ?? 0),
            quantity: 1,
            unit_of_measure: catalogItem.unit_of_measure || 'Nos',
            hsn_code: catalogItem.hsn_code || '',
            category_name: catalogItem.category_name || 'General',
            selectedMasterId: masterItemId,
            is_new: false,
            is_duplicate: false,
            createNew: false,
            suggestions: [
                {
                    master_item_id: masterItemId,
                    code: catalogItem.code || '',
                    description: catalogItem.description || '',
                    hsn_code: catalogItem.hsn_code || '',
                    category: catalogItem.category_name || 'General'
                }
            ]
        }

        setLineItems(prev => [...prev, newItem])
        setIsAddingItem(false)
        setAddItemSearch('')
    }

    const addCustomItem = (itemName: string) => {
        const cleanName = itemName.trim()
        if (!cleanName) return

        setLineItems(prev => [
            ...prev,
            {
                item_name: cleanName,
                item_code: '',
                item_price: 0,
                quantity: 1,
                unit_of_measure: 'Nos',
                hsn_code: '',
                category_name: 'General',
                selectedMasterId: '',
                is_new: true,
                is_duplicate: false,
                createNew: true,
                suggestions: []
            }
        ])
        setIsAddingItem(false)
        setAddItemSearch('')
    }

    const addItemMatches = useMemo(() => {
        const term = addItemSearch.trim().toLowerCase()
        if (term.length < 2) return []
        return masterItems
            .filter((m: any) => `${m.code || ''} ${m.description || ''}`.toLowerCase().includes(term))
            .slice(0, 30)
    }, [masterItems, addItemSearch])

    return (
        <div className="h-[calc(100vh-110px)] bg-[#f3f4f6] overflow-hidden flex flex-col">
            {/* TOOLBAR */}
            <div className="h-11 bg-white border-b px-4 flex items-center justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3">
                    <h1 className="text-[12px] font-bold text-slate-800 tracking-tight">Source document</h1>
                    <div className="flex items-center gap-2 px-2 py-0.5 bg-slate-100 rounded">
                        <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                            {file?.name || quotation?.filename || 'quotation_01.pdf'}
                        </span>
                        <X className="w-2.5 h-2.5 text-slate-400 cursor-pointer hover:text-slate-600" />
                    </div>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* PDF PREVIEW (LEFT) */}
                <div className="flex-[0.35] border-r flex flex-col bg-[#eef1f4] relative shadow-inner">
                    <div className="absolute top-3 left-3 z-10 flex gap-1.5">
                        <div className="bg-white/90 backdrop-blur-sm border shadow-sm rounded px-1.5 py-0.5 flex items-center gap-2 text-[9px] font-bold">
                            <span>Page 1/1</span>
                            <div className="w-px h-2.5 bg-slate-200" />
                            <span>Zoom 100%</span>
                            <div className="w-px h-2.5 bg-slate-200" />
                            <span>Fit</span>
                        </div>
                    </div>

                    {/* PDF AREA */}
                    <div className="flex-1 overflow-auto bg-[#eef1f4] p-4 flex justify-center">
                        <div className="w-full max-w-[760px] bg-[#fdfdfc] border border-slate-300 shadow-lg rounded-sm overflow-hidden min-h-[900px]">
                            {previewUrl ? (
                                <iframe
                                    src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                                    className="w-full h-full min-h-[1100px] border-none"
                                    title="Quotation Preview"
                                />
                            ) : (
                                <div className="h-full flex items-center justify-center text-slate-400 font-medium py-20 text-xs">
                                    Loading document preview...
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* VERIFICATION PANEL (RIGHT) */}
                <div className="flex-[0.65] bg-white flex flex-col overflow-hidden relative">
                    {/* Header */}
                    <div className="px-4 py-2.5 border-b">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-slate-900 tracking-tight uppercase tracking-wider">Extracted items</h2>
                                <Badge className="bg-violet-50 text-violet-600 border-violet-100 gap-1 px-1.5 py-0 text-[8px] h-3.5 mt-0.5">
                                    <Sparkles className="w-2 h-2" />
                                    AI
                                </Badge>
                            </div>
                            <Button
                                size="sm"
                                variant={isAddingItem ? "secondary" : "outline"}
                                className="h-7 text-[10px] font-bold px-2.5 shrink-0"
                                onClick={() => {
                                    setIsAddingItem(prev => !prev)
                                    if (isAddingItem) setAddItemSearch('')
                                }}
                            >
                                <Plus className="w-3 h-3 mr-1" />
                                Add more item
                            </Button>
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-1.5">
                            {[
                                { id: 'all', label: 'All', count: counts.all },
                                { id: 'matched', label: 'Matched', count: counts.matched },
                                { id: 'review', label: 'Review', count: counts.review },
                                { id: 'new', label: 'New', count: counts.new }
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setFilter(tab.id as any)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                                        filter === tab.id
                                            ? "bg-slate-900 text-white shadow"
                                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                    )}
                                >
                                    {tab.label}
                                    <span className={cn(
                                        "w-4 h-4 rounded-full flex items-center justify-center text-[9px]",
                                        filter === tab.id ? "bg-white/20" : "bg-slate-100"
                                    )}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Search */}
                    <div className="px-4 py-1.5 border-b bg-slate-50/30">
                        <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    type="text"
                                    placeholder="Search items..."
                                    className="w-full pl-8 pr-4 py-1 bg-transparent text-[11px] focus:outline-none placeholder:text-slate-400 font-medium"
                                />
                            </div>
                        </div>
                    </div>

                    {/* ITEMS LIST */}
                    <div className="flex-1 overflow-auto divide-y bg-slate-50/20">
                        {isAddingItem && (
                            <div className="bg-violet-50/40 border-b border-violet-100">
                                <div className="p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-[9px] font-bold text-violet-600 tracking-wider">NEW</span>
                                        <Badge className="text-[8px] uppercase tracking-tighter px-1.5 py-0 h-3.5 border-none font-black bg-primary/10 text-primary">
                                            Add Line Item
                                        </Badge>
                                    </div>
                                    <div className="rounded-lg border border-violet-200 bg-white shadow-sm overflow-hidden">
                                        <Command shouldFilter={false} className="border-none">
                                            <div className="flex items-center px-2.5 border-b bg-slate-50/50">
                                                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                                                <CommandInput
                                                    placeholder="Search catalog item name or code..."
                                                    className="h-9 text-[13px] border-none bg-transparent focus:ring-0"
                                                    value={addItemSearch}
                                                    onValueChange={setAddItemSearch}
                                                />
                                            </div>
                                            <CommandList className="max-h-[260px] overflow-y-auto">
                                                {addItemSearch.trim().length < 2 ? (
                                                    <div className="py-5 text-center text-[11px] text-slate-500">
                                                        Type at least 2 characters to search catalog items.
                                                    </div>
                                                ) : (
                                                    <>
                                                        {addItemMatches.length === 0 && (
                                                            <CommandEmpty className="py-5 text-center text-[11px] text-slate-500">No catalog matches found.</CommandEmpty>
                                                        )}
                                                        <CommandGroup heading={<span className="text-[9px] font-black uppercase text-violet-600 tracking-widest px-1">Catalog Results</span>}>
                                                            {addItemMatches.map((m: any) => (
                                                                <CommandItem
                                                                    key={m.hash_id || m.id}
                                                                    onSelect={() => addItemFromCatalog(m)}
                                                                    className="flex flex-col items-start px-3 py-2 gap-0.5 hover:bg-violet-50 cursor-pointer border-b last:border-none"
                                                                >
                                                                    <div className="flex items-center justify-between w-full">
                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.code || '—'}</span>
                                                                        <Plus className="w-2.5 h-2.5 text-slate-300" />
                                                                    </div>
                                                                    <span className="text-[12px] font-semibold text-slate-700 leading-tight">{m.description}</span>
                                                                    <span className="text-[9px] text-slate-400 font-medium">{m.category_name} · HSN {m.hsn_code || '—'}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                        <CommandGroup heading={<span className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Custom</span>}>
                                                            <CommandItem
                                                                onSelect={() => addCustomItem(addItemSearch)}
                                                                className="flex items-center px-3 py-2 gap-2 hover:bg-slate-50 cursor-pointer"
                                                            >
                                                                <Plus className="w-3 h-3 text-primary" />
                                                                <span className="text-[12px] font-semibold text-slate-700">Create custom item "{addItemSearch.trim()}"</span>
                                                            </CommandItem>
                                                        </CommandGroup>
                                                    </>
                                                )}
                                            </CommandList>
                                        </Command>
                                    </div>
                                </div>
                            </div>
                        )}
                        {filteredItems.map((item, idx) => (
                            <div key={idx} className="group relative bg-white hover:bg-slate-50/50 transition-all duration-150">
                                <div className="p-3 flex gap-3">
                                    {/* Left: Original Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[9px] font-bold text-slate-400 tracking-wider">L{item.originalIndex + 1}</span>
                                            <Badge className={cn(
                                                "text-[8px] uppercase tracking-tighter px-1.5 py-0 h-3.5 border-none font-black",
                                                item.status === 'matched' ? "bg-emerald-100 text-emerald-700" :
                                                    item.status === 'review' ? "bg-amber-100 text-amber-700" :
                                                        "bg-primary/10 text-primary"
                                            )}>
                                                {item.status === 'matched' ? 'Matched' : item.status === 'review' ? 'Needs Review' : 'New'}
                                            </Badge>
                                        </div>

                                        <h3 className="text-[15px] font-bold text-slate-800 leading-tight mb-1 group-hover:text-violet-700 transition-colors truncate">
                                            {item.item_name}
                                        </h3>

                                        <div className="flex items-center gap-3 text-[11px] font-semibold text-slate-400">
                                            <span>{Number(item.quantity || 0)} {item.unit_of_measure || 'Nos'}</span>
                                            <div className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                            <span>₹{Number(item.item_price || 0).toLocaleString('en-IN')}/u</span>
                                            <div className="w-0.5 h-0.5 rounded-full bg-slate-300" />
                                            <span className="text-slate-600 font-bold">₹{(Number(item.quantity || 0) * Number(item.item_price || 0)).toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>

                                    {/* Right: Mapping Selector */}
                                    <div className="flex-1 flex items-center justify-end pr-1">
                                        <div className="flex items-center gap-2 w-full justify-end">
                                            {item.is_new ? (
                                               ""
                                            ) : (
                                                <Popover onOpenChange={(open) => { if (!open) setMappingSearch('') }}>
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full max-w-[240px] h-8.5 px-2.5 justify-between bg-white border-slate-200 text-slate-700 shadow-sm hover:border-violet-300 transition-all font-semibold rounded-lg"
                                                        >
                                                            <div className="flex flex-col items-start min-w-0 pr-2">
                                                                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-wider leading-none">{item.mapping.code}</span>
                                                                <span className="text-[11px] truncate w-full text-left font-bold leading-tight">{item.mapping.description}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 ml-1.5 shrink-0">
                                                                <span className="text-[9px] font-bold text-violet-600 bg-violet-100 px-1 py-0 rounded">98%</span>
                                                                <ChevronDown className="h-3 w-3 opacity-40" />
                                                            </div>
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent className="p-0 w-[380px] shadow-2xl border-slate-200 rounded-xl overflow-hidden" align="end">
                                                        <Command shouldFilter={false} className="border-none">
                                                            <div className="flex items-center px-2.5 border-b bg-slate-50/50">
                                                                <Search className="w-3.5 h-3.5 text-slate-400 mr-2 shrink-0" />
                                                                <CommandInput
                                                                    placeholder="Search catalog..."
                                                                    className="h-9 text-[13px] border-none bg-transparent focus:ring-0"
                                                                    value={mappingSearch}
                                                                    onValueChange={setMappingSearch}
                                                                />
                                                            </div>
                                                            <CommandList className="max-h-[300px] overflow-y-auto">
                                                                <CommandEmpty className="py-5 text-center text-[11px] text-slate-500">No matches found.</CommandEmpty>

                                                                <CommandGroup heading={<span className="text-[9px] font-black uppercase text-violet-600 tracking-widest px-1">AI Suggestions</span>}>
                                                                    {(item.suggestions || [])
                                                                        .filter((s: any) => !mappingSearch || `${s.code} ${s.description}`.toLowerCase().includes(mappingSearch.toLowerCase()))
                                                                        .map((s: any) => (
                                                                            <CommandItem
                                                                                key={s.master_item_id}
                                                                                onSelect={() => { handleUpdateMapping(item.originalIndex, s); setMappingSearch('') }}
                                                                                className="flex flex-col items-start px-3 py-2 gap-0.5 hover:bg-violet-50 cursor-pointer border-b last:border-none"
                                                                            >
                                                                                <div className="flex items-center justify-between w-full">
                                                                                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{s.code}</span>
                                                                                    <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-black text-[8px] uppercase h-3.5">MATCH</Badge>
                                                                                </div>
                                                                                <span className="text-[12px] font-bold text-slate-700 leading-tight">{s.description}</span>
                                                                                <span className="text-[9px] text-slate-400 font-medium">{s.category} · HSN {s.hsn_code}</span>
                                                                            </CommandItem>
                                                                        ))}
                                                                </CommandGroup>

                                                                {mappingSearch.length >= 2 && (
                                                                    <CommandGroup heading={<span className="text-[9px] font-black uppercase text-primary tracking-widest px-1">Global Catalog</span>}>
                                                                        {masterItems
                                                                            .filter((m: any) => {
                                                                                const isSuggestion = item.suggestions?.some((s: any) => String(s.master_item_id) === String(m.hash_id || m.id))
                                                                                const searchLower = mappingSearch.toLowerCase()
                                                                                const matches = (m.code?.toLowerCase().includes(searchLower) || m.description?.toLowerCase().includes(searchLower))
                                                                                return !isSuggestion && matches
                                                                            })
                                                                            .slice(0, 30)
                                                                            .map((m: any) => (
                                                                                <CommandItem
                                                                                    key={m.hash_id || m.id}
                                                                                    onSelect={() => {
                                                                                        handleUpdateMapping(item.originalIndex, {
                                                                                            master_item_id: m.hash_id || m.id,
                                                                                            code: m.code,
                                                                                            description: m.description,
                                                                                            hsn_code: m.hsn_code,
                                                                                            category: m.category_name
                                                                                        });
                                                                                        setMappingSearch('')
                                                                                    }}
                                                                                    className="flex flex-col items-start px-3 py-2 gap-0.5 hover:bg-slate-50 cursor-pointer border-b last:border-none"
                                                                                >
                                                                                    <div className="flex items-center justify-between w-full">
                                                                                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{m.code}</span>
                                                                                        <Plus className="w-2.5 h-2.5 text-slate-300" />
                                                                                    </div>
                                                                                    <span className="text-[12px] font-semibold text-slate-700 leading-tight">{m.description}</span>
                                                                                    <span className="text-[9px] text-slate-400 font-medium">{m.category_name} · HSN {m.hsn_code}</span>
                                                                                </CommandItem>
                                                                            ))}
                                                                    </CommandGroup>
                                                                )}
                                                            </CommandList>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                            )}

                                            {/* Action Menu */}
                                            <div className="flex items-center gap-1 border-l pl-2 ml-1">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7 text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors rounded-md"
                                                    onClick={() => handleDeleteItem(item.originalIndex)}
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className={cn(
                                                        "h-7 w-7 transition-all rounded-md",
                                                        item.is_new
                                                            ? "text-primary bg-primary/10 border border-primary/20"
                                                            : "text-slate-300 hover:text-primary"
                                                    )}
                                                    onClick={() => handleSetAsNew(item.originalIndex, !item.is_new)}
                                                >
                                                    {item.is_new ? <RotateCcw className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}

export default VerifyItemsStep
