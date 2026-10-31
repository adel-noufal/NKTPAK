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
              className={`relative rounded-xl p-5 border transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'bg-blue-950/40 border-blue-500 shadow-lg shadow-blue-500/10'
                  : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Badges header */}
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="font-bold text-slate-100 text-sm">{alt.name}</span>
                {isRecommended ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    ⭐ RECOMMENDED
                  </span>
                ) : (
                  <span className="text-[11px] text-slate-400 font-medium">ALTERNATIVE</span>
                )}
              </div>

              <p className="text-xs text-slate-400 mb-4">{alt.description}</p>

              {/* Key Metrics */}
              <div className="space-y-2.5 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80 mb-4 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Dimensions:</span>
                  <span className="text-slate-200 font-bold">
                    {alt.outer_length_mm} × {alt.outer_width_mm} × {alt.outer_height_mm} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Vol. Utilization:</span>
                  <span className="text-blue-400 font-bold">
                    {alt.savings.volume_utilization_pct}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Material Vol:</span>
                  <span className="text-slate-200">
                    {alt.material_usage.total_material_volume_cm3} cm³
                  </span>
                </div>
                {alt.savings.savings_status === 'CALCULATED' && (
                  <div className="flex justify-between border-t border-slate-800 pt-1.5">
                    <span className="text-slate-400">Material Saved:</span>
                    <span
                      className={`font-bold ${
                        (alt.savings.material_saved_pct || 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'
                      }`}
                    >
                      {alt.savings.material_saved_pct}%
                    </span>
                  </div>
                )}
                {alt.cost.total_cost !== null && alt.cost.total_cost !== undefined && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Unit Cost:</span>
                    <span className="text-slate-200 font-bold">
                      {alt.cost.total_cost} {alt.cost.currency || ''}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="button"
                className={`w-full py-2 rounded-lg text-xs font-semibold transition-all ${
                  isSelected
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {isSelected ? '✓ Active in 3D View' : 'Select for 3D View'}
              </button>
            </div>
          )
        })}
      </div>

      {/* Comparison Table */}
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 overflow-hidden shadow-xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            📊 Detailed Engineering Comparison
          </h3>
          <DataBadge label="ESTIMATE" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Parameter</th>
                {baseline && <th className="py-3 px-4 bg-slate-900/40">Baseline (Current)</th>}
                {alternatives.map((alt) => (
                  <th
                    key={alt.alternative_id}
                    className={`py-3 px-4 ${
                      alt.rank === AlternativeRank.RECOMMENDED ? 'bg-blue-950/30 text-blue-300' : ''
                    }`}
                  >
                    {alt.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              <tr>
                <td className="py-3 px-4 font-semibold text-slate-400">Outer Dims (mm)</td>
                {baseline && (
                  <td className="py-3 px-4 font-mono bg-slate-900/20">
                    {baseline.carton_outer_length_mm} × {baseline.carton_outer_width_mm} × {baseline.carton_outer_height_mm}
                  </td>
                )}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-3 px-4 font-mono">
                    {a.outer_length_mm} × {a.outer_width_mm} × {a.outer_height_mm}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-400">Volume Utilization</td>
                {baseline && <td className="py-3 px-4 font-mono bg-slate-900/20">-</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-3 px-4 font-mono font-bold text-blue-400">
                    {a.savings.volume_utilization_pct}%
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-400">Board Area (cm²)</td>
                {baseline && <td className="py-3 px-4 font-mono bg-slate-900/20">-</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-3 px-4 font-mono">
                    {a.material_usage.carton_board_area_cm2} cm²
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-400">Material Saved (%)</td>
                {baseline && <td className="py-3 px-4 font-mono bg-slate-900/20">0% (Baseline)</td>}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-3 px-4 font-mono">
                    {a.savings.savings_status === 'CALCULATED' ? (
                      <span
                        className={`font-bold ${
                          (a.savings.material_saved_pct || 0) >= 0 ? 'text-emerald-400' : 'text-amber-400'
                        }`}
                      >
                        {a.savings.material_saved_pct}%
                      </span>
                    ) : (
                      <span className="text-slate-500">NOT CONFIGURED</span>
                    )}
                  </td>
                ))}
              </tr>

              <tr>
                <td className="py-3 px-4 font-semibold text-slate-400">Estimated Cost</td>
                {baseline && (
                  <td className="py-3 px-4 font-mono bg-slate-900/20">
                    {baseline.carton_cost_per_unit || 'NOT_CONFIGURED'} {baseline.currency || ''}
                  </td>
                )}
                {alternatives.map((a) => (
                  <td key={a.alternative_id} className="py-3 px-4 font-mono">
                    {a.cost.total_cost !== null && a.cost.total_cost !== undefined ? (
                      <span>
                        {a.cost.total_cost} {a.cost.currency}
                      </span>
                    ) : (
                      <span className="text-slate-500">NOT CONFIGURED</span>
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
