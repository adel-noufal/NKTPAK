import React, { useState } from 'react'
import type { BaselinePackaging, PlannedPackaging, PackagingAlternative } from '../../types'

interface ComparisonPanelProps {
  baseline?: BaselinePackaging | null
  planned?: PlannedPackaging | null
  proposed?: PackagingAlternative | null
}

function vol(l?: number | null, w?: number | null, h?: number | null): number | null {
  if (l && w && h) return (l * w * h) / 1e6  // litres
  return null
}

function fmt(v: number | null | undefined, unit: string, decimals = 1): string {
  if (v == null) return '—'
  return `${v.toFixed(decimals)} ${unit}`
}

interface RowProps {
  label: string
  baseline: string
  planned: string
  proposed: string
  note?: string
  formula?: string
}

const Row: React.FC<RowProps & { showFormulas: boolean }> = ({
  label, baseline, planned, proposed, note, formula, showFormulas,
}) => (
  <tr className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
    <td className="py-2 px-3 text-xs font-medium text-slate-700 dark:text-slate-300 w-40">
      {label}
      {note && <div className="text-[10px] text-slate-400 mt-0.5">{note}</div>}
      {showFormulas && formula && (
        <div className="text-[10px] text-blue-500 font-mono mt-0.5">{formula}</div>
      )}
    </td>
    <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400 text-center">{baseline}</td>
    <td className="py-2 px-3 text-xs text-slate-600 dark:text-slate-400 text-center">{planned}</td>
    <td className="py-2 px-3 text-xs font-semibold text-blue-700 dark:text-blue-300 text-center">{proposed}</td>
  </tr>
)

export const ComparisonPanel: React.FC<ComparisonPanelProps> = ({
  baseline, planned, proposed,
}) => {
  const [showFormulas, setShowFormulas] = useState(false)

  const bVol = vol(
    baseline?.carton_outer_length_mm,
    baseline?.carton_outer_width_mm,
    baseline?.carton_outer_height_mm,
  )
  const pVol = vol(
    planned?.carton_outer_length_mm,
    planned?.carton_outer_width_mm,
    planned?.carton_outer_height_mm,
  )
  const rVol = vol(proposed?.outer_length_mm, proposed?.outer_width_mm, proposed?.outer_height_mm)

  const bInnerVol = baseline?.board_thickness_mm
    ? vol(
        baseline.carton_outer_length_mm - 2 * baseline.board_thickness_mm,
        baseline.carton_outer_width_mm - 2 * baseline.board_thickness_mm,
        baseline.carton_outer_height_mm - 2 * baseline.board_thickness_mm,
      )
    : null

  const rInnerVol = vol(proposed?.inner_length_mm, proposed?.inner_width_mm, proposed?.inner_height_mm)

  const rows: (RowProps & { key: string })[] = [
    {
      key: 'outer_dims',
      label: 'Outer dimensions',
      note: '(mm)',
      baseline: baseline
        ? `${baseline.carton_outer_length_mm} × ${baseline.carton_outer_width_mm} × ${baseline.carton_outer_height_mm}`
        : '—',
      planned: planned
        ? `${planned.carton_outer_length_mm} × ${planned.carton_outer_width_mm} × ${planned.carton_outer_height_mm}`
        : '—',
      proposed: proposed
        ? `${proposed.outer_length_mm} × ${proposed.outer_width_mm} × ${proposed.outer_height_mm}`
        : '—',
      formula: 'L × W × H (external carton)',
    },
    {
      key: 'outer_vol',
      label: 'Outer volume',
      note: '(litres)',
      baseline: fmt(bVol, 'L'),
      planned: fmt(pVol, 'L'),
      proposed: fmt(rVol, 'L'),
      formula: 'L × W × H ÷ 1,000,000',
    },
    {
      key: 'board_thickness',
      label: 'Board thickness',
      note: '(mm)',
      baseline: baseline?.board_thickness_mm ? `${baseline.board_thickness_mm} mm` : 'Not available — enter it',
      planned: planned?.board_thickness_mm ? `${planned.board_thickness_mm} mm` : '—',
      proposed: proposed ? `${proposed.board_thickness_mm} mm` : '—',
    },
    {
      key: 'inner_vol',
      label: 'Inner volume',
      note: '(litres)',
      baseline: bInnerVol != null
        ? fmt(bInnerVol, 'L')
        : baseline
          ? 'Needs board thickness'
          : '—',
      planned: '—',
      proposed: fmt(rInnerVol, 'L'),
      formula: '(L − 2t) × (W − 2t) × (H − 2t) ÷ 1,000,000',
    },
    {
      key: 'util',
      label: 'Volume utilization',
      baseline: '—',
      planned: '—',
      proposed: proposed?.savings.volume_utilization_pct != null
        ? `${proposed.savings.volume_utilization_pct.toFixed(1)}%`
        : '—',
      formula: 'product_volume ÷ inner_volume × 100',
    },
    {
      key: 'mat_saved',
      label: 'Material saved',
      baseline: 'Baseline',
      planned: '—',
      proposed: proposed?.savings.material_saved_pct != null
        ? `${proposed.savings.material_saved_pct.toFixed(1)}%`
        : baseline?.board_thickness_mm == null
          ? 'Needs board thickness'
          : 'Needs baseline',
      formula: '(baseline_material − proposed_material) ÷ baseline_material × 100',
    },
    {
      key: 'cost',
      label: 'Cost per unit',
      baseline: baseline?.carton_cost_per_unit
        ? `${baseline.carton_cost_per_unit} ${baseline.currency ?? ''}`
        : 'Not available — enter it',
      planned: '—',
      proposed: proposed?.cost.total_cost != null
        ? `${proposed.cost.total_cost.toFixed(2)} ${proposed.cost.currency ?? ''}`
        : 'Needs cost input',
    },
  ]

  const hasAny = baseline || planned || proposed

  if (!hasAny) {
    return (
      <div className="text-center py-12 text-slate-400 text-sm">
        <p>No packaging data to compare yet.</p>
        <p className="text-xs mt-1 text-slate-500">Enter baseline packaging and run optimization to see comparison.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Side-by-Side Comparison</h3>
        <button
          type="button"
          onClick={() => setShowFormulas((v) => !v)}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showFormulas ? 'Hide formulas' : 'Show formulas'}
        </button>
      </div>

      <div className="text-[11px] text-slate-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">
        Clearances are engineering assumptions — user-editable, not ISO-specified values.
        Savings are geometric estimates only. Physical testing required before production use.
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full">
          <thead className="bg-slate-100 dark:bg-slate-800">
            <tr>
              <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider w-40">
                Metric
              </th>
              <th className="text-center px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Actual (Baseline)
              </th>
              <th className="text-center px-3 py-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                My Plan
              </th>
              <th className="text-center px-3 py-2 text-[11px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                Proposed
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-slate-900">
            {rows.map(({ key, ...rest }) => (
              <Row key={key} {...rest} showFormulas={showFormulas} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-[10px] text-slate-400">
        Evaluated against: NxtPak ISO registry v1 (see source list). No company-specific requirements loaded.
      </p>
    </div>
  )
}
