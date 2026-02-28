'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'

interface ApprovalLevel {
  id: number
  level_number: number
  user_name: string | null
  role_name: string | null
  sla_hours: number | null
}

interface ApprovalMatrix {
  id: number
  name: string
  plant_name?: string | null
  levels?: ApprovalLevel[]
}

interface Props {
  matrices: ApprovalMatrix[]
  selectedMatrix: number | null
  expandedMatrix: number | null
  onSelect: (id: number) => void
  onToggleExpand: (id: number) => void
}

export function MatrixSelectorTable({
  matrices,
  selectedMatrix,
  expandedMatrix,
  onSelect,
  onToggleExpand,
}: Props) {
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            <th className="w-8 px-3 py-2.5" />
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Matrix Name</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Plant</th>
            <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Levels</th>
            <th className="w-8 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {matrices.map((m) => {
            const levelCount = m.levels?.length ?? 0
            const isSelected = selectedMatrix === m.id
            const isExpanded = expandedMatrix === m.id
            return (
              <>
                <tr
                  key={m.id}
                  className={`transition-colors ${isSelected ? 'bg-primary/5' : 'hover:bg-muted/40'}`}
                >
                  <td className="px-3 py-2.5 text-center">
                    <label htmlFor={`matrix-radio-${m.id}`} className="cursor-pointer flex items-center justify-center">
                      <input
                        type="radio"
                        id={`matrix-radio-${m.id}`}
                        name="approval-matrix"
                        checked={isSelected}
                        onChange={() => onSelect(m.id)}
                        className="accent-primary w-4 h-4"
                      />
                    </label>
                  </td>
                  <td className="px-3 py-2.5 font-medium text-foreground cursor-pointer" onClick={() => onSelect(m.id)}>
                    {m.name}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell cursor-pointer" onClick={() => onSelect(m.id)}>
                    {m.plant_name || 'All Plants'}
                  </td>
                  <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelect(m.id)}>
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                      {levelCount} level{levelCount === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      type="button"
                      onClick={() => onToggleExpand(m.id)}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${m.id}-levels`}>
                    <td colSpan={5} className="p-0">
                      <div className="bg-muted/30 border-t border-border px-6 py-3">
                        {levelCount === 0 ? (
                          <p className="text-xs text-muted-foreground py-1">No levels configured.</p>
                        ) : (
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground">
                                <th className="text-left py-1.5 pr-4 font-semibold w-12">Level</th>
                                <th className="text-left py-1.5 pr-4 font-semibold">Approver</th>
                                <th className="text-left py-1.5 pr-4 font-semibold">Role</th>
                                <th className="text-right py-1.5 font-semibold w-16">SLA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(m.levels ?? []).map((lv) => (
                                <tr key={lv.id} className="border-t border-border/60">
                                  <td className="py-1.5 pr-4">
                                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-xs">
                                      {lv.level_number}
                                    </span>
                                  </td>
                                  <td className="py-1.5 pr-4 font-medium text-foreground">{lv.user_name ?? '—'}</td>
                                  <td className="py-1.5 pr-4 text-muted-foreground">{lv.role_name ?? '—'}</td>
                                  <td className="py-1.5 text-right text-muted-foreground">{lv.sla_hours ? `${lv.sla_hours}h` : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
