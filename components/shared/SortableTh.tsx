import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";


type SortDir = 'asc' | 'desc'
type SortField = 'company_name' | 'status' | 'created_at' | 'category_name' | 'performance_score'

 function SortIcon({ field, current, dir }: Readonly<{ field: SortField; current: SortField; dir: SortDir }>) {
    if (field !== current) return <ChevronsUpDown className="w-3 h-3 text-muted-foreground/50 inline-block ml-1" />
    return dir === 'asc'
      ? <ChevronUp className="w-3 h-3 text-primary inline-block ml-1" />
      : <ChevronDown className="w-3 h-3 text-primary inline-block ml-1" />
  }

  export function SortableTh({
    field, label, current, dir, onSort, className = '',
  }: Readonly<{
    field: SortField; label: string; current: SortField; dir: SortDir
    onSort: (f: SortField) => void; className?: string
  }>) {
    return (
      <th className={`px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide ${className}`}>
        <button
          type="button"
          onClick={() => onSort(field)}
          className="flex items-center gap-0.5 hover:text-foreground transition-colors uppercase"
        >
          {label} <SortIcon field={field} current={current} dir={dir} />
        </button>
      </th>
    )
  }