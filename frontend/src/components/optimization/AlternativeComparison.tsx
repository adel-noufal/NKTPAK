import React from 'react'
import { AlternativeRank, PackagingAlternative, BaselinePackaging } from '../../types'
import { DataBadge } from '../common/DataBadge'

interface AlternativeComparisonProps {
  alternatives: PackagingAlternative[]
  baseline?: BaselinePackaging | null
  selectedAlternativeId?: string
  onSelectAlternative: (alt: PackagingAlternative) => void
}

export const AlternativeComparison: React.FC<AlternativeComparisonProps> = ({
  alternatives,
  baseline,
  selectedAlternativeId,
  onSelectAlternative,
}) => {
  return (
    <div className="space-y-6">
      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {alternatives.map((alt) => {
          const isSelected = selectedAlternativeId === alt.alternative_id
          const isRecommended = alt.rank === AlternativeRank.RECOMMENDED

          return (
            <div
              key={alt.alternative_id}
              onClick={() => onSelectAlternative(alt)}
              className={`relative rounded-lg p-4 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500 shadow-sm'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-400 dark:hover:border-slate-700'
              }`}
            >
              {/* Badges header */}
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">{alt.name}</span>
                {isRecommended ? (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                    RECOMMENDED
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-500 font-medium">ALTERNATIVE</span>
                )}
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{alt.description}</p>

              {/* Key Metrics */}
              <div className="space-y-2 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded border border-slate-200 dark:border-slate-800 mb-3 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Dimensions:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-medium">
                    {alt.outer_length_mm} × {alt.outer_width_mm} × {alt.outer_height_mm} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Vol. Utilization:</span>
                  <span className="text-blue-600 dark:text-blue-400 font-bold">
                    {alt.savings.volume_utilization_pct.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Material Vol:</span>
                  <span className="text-slate-700 dark:text-slate-300">
                    {alt.material_usage.total_material_volume_cm3.toFixed(0)} cm³
                  </span>
                </div>
                {alt.savings.savings_status === 'CALCULATED' && (
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-800 pt-1">
                    <span className="text-slate-500">Material Saved:</span>
                    <span
                      className={`font-bold ${
                        (alt.savings.material_saved_pct || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {alt.savings.material_saved_pct?.toFixed(1)}%
                    </span>
                  </div>
                )}
                {alt.cost.total_cost !== null && alt.cost.total_cost !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Unit Cost:</span>
                    <span className="text-slate-800 dark:text-slate-200 font-medium">
                      {alt.cost.total_cost.toFixed(2)} {alt.cost.currency || ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                className={`w-full py-1.5 rounded text-xs font-medium transition-colors ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isSelected ? 'Active in 3D View' : 'Select for 3D View'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
            Detailed Engineering Comparison
          </h3>
          <DataBadge label="ESTIMATE" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 uppercase tracking-wider text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Parameter</th>
                {baseline && <th className="py-2.5 px-3">Baseline (Current)</th>}
                {alternatives.map((alt) => (
                  <th
                    key={alt.alternative_id}
                    className={`py-2.5 px-3 ${
                      alt.rank === AlternativeRank.RECOMMENDED ? 'text-blue-600 dark:text-blue-400 font-bold' : ''
                    }`}
                  >
                    {alt.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-600 dark:text-slate-300">
              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-500">Outer Dims (mm)</td>
                {baseline && (
                  <td className="py-2.5 px-3 font-mono">
                    {baseline.carton_outer_length_mm} × {baseline.carton_outer_width_mm} × {baseline.carton_outer_height_mm}
                  </td>
                )}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-2.5 px-3 font-mono">
                    {a.outer_length_mm} × {a.outer_width_mm} × {a.outer_height_mm}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-500">Volume Utilization</td>
                {baseline && <td className="py-2.5 px-3 font-mono">-</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400">
                    {a.savings.volume_utilization_pct.toFixed(1)}%
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-500">Board Area (cm²)</td>
                {baseline && <td className="py-2.5 px-3 font-mono">-</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-2.5 px-3 font-mono">
                    {a.material_usage.carton_board_area_cm2.toFixed(0)} cm²
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-500">Material Saved (%)</td>
                {baseline && <td className="py-2.5 px-3 font-mono">0% (Baseline)</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-2.5 px-3 font-mono">
                    {a.savings.savings_status === 'CALCULATED' ? (
                      <span
                        className={`font-semibold ${
                          (a.savings.material_saved_pct || 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {a.savings.material_saved_pct?.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">NOT CONFIGURED</span>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-2.5 px-3 font-medium text-slate-500">Estimated Cost</td>
                {baseline && (
                  <td className="py-2.5 px-3 font-mono">
                    {baseline.carton_cost_per_unit != null ? `${baseline.carton_cost_per_unit} ${baseline.currency || ''}` : 'Not available'}
                  </td>
                )}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-2.5 px-3 font-mono">
                    {a.cost.total_cost !== null && a.cost.total_cost !== undefined ? (
                      <span>
                        {a.cost.total_cost.toFixed(2)} {a.cost.currency || ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">NOT CONFIGURED</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
