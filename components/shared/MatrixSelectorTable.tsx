'use client'

import React from 'react'
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
  const thSt: React.CSSProperties = {
    textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '.05em',
    color: 'hsl(var(--muted-foreground))', fontFamily: "'DM Sans',sans-serif", whiteSpace: 'nowrap',
  }

  return (
    <div style={{ border: '0.5px solid rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
        <thead style={{ background: '#f8f8f6', borderBottom: '0.5px solid rgba(0,0,0,0.08)' }}>
          <tr>
            <th style={{ width: 36, padding: '8px 12px' }} />
            <th style={thSt}>Matrix Name</th>
            <th style={{ ...thSt, display: 'none' }} className="sm:table-cell">Plant</th>
            <th style={thSt}>Levels</th>
            <th style={{ width: 36, padding: '8px 12px' }} />
          </tr>
        </thead>
        <tbody style={{ background: '#fff' }}>
          {matrices.map((m) => {
            const levelCount = m.levels?.length ?? 0
            const isSelected = selectedMatrix === m.id
            const isExpanded = expandedMatrix === m.id
            const tdBase: React.CSSProperties = { padding: '9px 12px', fontFamily: "'DM Sans',sans-serif", fontSize: 13, borderBottom: '0.5px solid rgba(0,0,0,0.06)', cursor: 'pointer' }
            return (
              <>
                <tr
                  key={m.id}
                  style={{ background: isSelected ? 'hsl(var(--primary) / 0.05)' : '#fff', transition: 'background .12s' }}
                  className={isSelected ? '' : 'hover:bg-slate-50'}
                >
                  <td style={{ ...tdBase, width: 36, textAlign: 'center' }}>
                    <label htmlFor={`matrix-radio-${m.id}`} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
                  <td style={{ ...tdBase, fontWeight: 500, color: '#1a1a18' }} onClick={() => onSelect(m.id)}>
                    {m.name}
                  </td>
                  <td style={{ ...tdBase, color: 'hsl(var(--muted-foreground))' }} className="hidden sm:table-cell" onClick={() => onSelect(m.id)}>
                    {m.plant_name || 'All Plants'}
                  </td>
                  <td style={tdBase} onClick={() => onSelect(m.id)}>
                    <span style={{ fontSize: 12, background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: 99 }}>
                      {levelCount} level{levelCount === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td style={{ ...tdBase, width: 36, textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => onToggleExpand(m.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', display: 'flex', alignItems: 'center' }}
                    >
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
                {isExpanded && (
                  <tr key={`${m.id}-levels`}>
                    <td colSpan={5} style={{ padding: 0 }}>
                      <div style={{ background: 'hsl(var(--muted)/0.3)', borderTop: '0.5px solid rgba(0,0,0,0.08)', padding: '10px 16px 10px 28px' }}>
                        {levelCount === 0 ? (
                          <p style={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', padding: '2px 0' }}>No levels configured.</p>
                        ) : (
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'DM Sans',sans-serif", fontSize: 12 }}>
                            <thead>
                              <tr style={{ color: 'hsl(var(--muted-foreground))' }}>
                                <th style={{ textAlign: 'left', padding: '4px 16px 4px 0', fontWeight: 700, width: 48 }}>Level</th>
                                <th style={{ textAlign: 'left', padding: '4px 16px 4px 0', fontWeight: 700 }}>Approver</th>
                                <th style={{ textAlign: 'left', padding: '4px 16px 4px 0', fontWeight: 700 }}>Role</th>
                                <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 700, width: 56 }}>SLA</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(m.levels ?? []).map((lv) => (
                                <tr key={lv.id} style={{ borderTop: '0.5px solid rgba(0,0,0,0.06)' }}>
                                  <td style={{ padding: '5px 16px 5px 0' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: '50%', background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))', fontWeight: 700, fontSize: 11 }}>
                                      {lv.level_number}
                                    </span>
                                  </td>
                                  <td style={{ padding: '5px 16px 5px 0', fontWeight: 500, color: '#1a1a18' }}>{lv.user_name ?? '—'}</td>
                                  <td style={{ padding: '5px 16px 5px 0', color: 'hsl(var(--muted-foreground))' }}>{lv.role_name ?? '—'}</td>
                                  <td style={{ padding: '5px 0', textAlign: 'right', color: 'hsl(var(--muted-foreground))' }}>{lv.sla_hours ? `${lv.sla_hours}h` : '—'}</td>
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
