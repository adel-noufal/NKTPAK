import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject } from '../api/projects'
import { PackagingViewer3D } from '../components/viewer/PackagingViewer3D'
import { AlternativeComparison } from '../components/optimization/AlternativeComparison'
import { StandardsTable } from '../components/standards/StandardsTable'
import { ExportPanel } from '../components/export/ExportPanel'
import { DataBadge } from '../components/common/DataBadge'
import type { PackagingAlternative } from '../types'

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<'3d' | 'comparison' | 'standards' | 'export'>('3d')

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })

  // Selected alternative in 3D viewer
  const [selectedAlt, setSelectedAlt] = useState<PackagingAlternative | null>(null)

  // Auto-select recommended when loaded
  React.useEffect(() => {
    if (project?.optimization_result?.recommended && !selectedAlt) {
      setSelectedAlt(project.optimization_result.recommended)
    }
  }, [project, selectedAlt])

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        <div className="inline-block w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Loading project and computed 3D models...</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-300 p-6 rounded-xl text-center space-y-3">
        <p className="font-semibold text-sm">Could not load project</p>
        <p className="text-xs text-rose-400">{(error as any)?.message || 'Project not found'}</p>
        <Link to="/" className="inline-block px-4 py-2 rounded-lg bg-slate-800 text-white text-xs">
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const optResult = project.optimization_result
  const stdResult = project.standards_result
  const alternatives = optResult?.alternatives || []
  const activeAlt = selectedAlt || optResult?.recommended || alternatives[0]

  const productData = project.product_data || {}
  const productDims = {
    length: productData.packed_dimensions?.length || 300,
    width: productData.packed_dimensions?.width || 200,
    height: productData.packed_dimensions?.height || 150,
  }

  return (
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link to="/projects" className="text-xs text-blue-400 hover:underline">
              ← Projects
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-xs text-slate-400">{project.product_data?.category || 'General'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-3">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-slate-400">
            <DataBadge label={project.product_data?.provenance?.data_label || 'USER ENTERED'} />
            <span className="text-slate-600">•</span>
            <span>
              Product:{' '}
              <strong className="text-slate-200">
                {productDims.length} × {productDims.width} × {productDims.height} mm
              </strong>
            </span>
            <span className="text-slate-600">•</span>
            <span>
              Weight: <strong className="text-slate-200">{productData.weight_kg} kg</strong>
            </span>
          </div>
        </div>

        {/* Quick export button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all flex items-center gap-2"
          >
            <span>📑</span>
            <span>Download Engineering Report</span>
          </button>
        </div>
      </div>

      {/* Optimization Highlights Banner */}
      {activeAlt && (
        <div className="bg-gradient-to-r from-blue-950/70 via-slate-900 to-indigo-950/70 border border-blue-900/40 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center text-lg font-bold border border-blue-500/30">
              {activeAlt.rank === 'RECOMMENDED' ? '⭐' : '📦'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-100 text-sm">{activeAlt.name}</span>
                {activeAlt.rank === 'RECOMMENDED' && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    RECOMMENDED CANDIDATE
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">{activeAlt.description}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
            <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Vol. Utilization</span>
              <span className="text-blue-400 font-bold text-sm">{activeAlt.savings.volume_utilization_pct}%</span>
            </div>
            {activeAlt.savings.savings_status === 'CALCULATED' ? (
              <>
                <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                  <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Material Saved</span>
                  <span className={`font-bold text-sm ${activeAlt.savings.material_saved_pct! >= 0 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {activeAlt.savings.material_saved_pct}%
                  </span>
                </div>
                {activeAlt.savings.cost_saved !== null && activeAlt.savings.cost_saved !== undefined && (
                  <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Unit Savings</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      {activeAlt.savings.cost_saved} {activeAlt.savings.currency || activeAlt.cost.currency || ''}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-slate-950/80 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400 text-[10px] block uppercase tracking-wider">Savings vs Baseline</span>
                <span className="text-amber-400 font-bold text-xs">NO BASELINE CONFIGURED</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('3d')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === '3d'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📦</span>
          <span>3D Workspace</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('comparison')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'comparison'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📊</span>
          <span>Optimization & Savings</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('standards')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'standards'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📜</span>
          <span>ISO Standards Evaluation ({stdResult?.results?.length || 16})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className={`py-3 px-4 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'export'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <span>📑</span>
          <span>Exports (PDF/HTML)</span>
        </button>
      </div>

      {/* Tab 1: 3D Workspace */}
      {activeTab === '3d' && (
        <div className="space-y-6">
          <PackagingViewer3D alternative={activeAlt} productDims={productDims} />

          {/* Quick Alternative Switcher under 3D canvas */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Select Candidate Alternative:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {alternatives.map((alt) => {
                const isSelected = activeAlt?.alternative_id === alt.alternative_id
                return (
                  <div
                    key={alt.alternative_id}
                    onClick={() => setSelectedAlt(alt)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-blue-950/40 border-blue-500 shadow-md'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-white">{alt.name}</span>
                      {alt.rank === 'RECOMMENDED' && (
                        <span className="text-[10px] font-bold text-emerald-400">RECOMMENDED</span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      {alt.outer_length_mm} × {alt.outer_width_mm} × {alt.outer_height_mm} mm
                    </div>
                    <div className="text-[11px] text-blue-400 font-bold mt-1">
                      {alt.savings.volume_utilization_pct}% volume utilization
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Optimization & Comparison */}
      {activeTab === 'comparison' && (
        <AlternativeComparison
          alternatives={alternatives}
          baseline={project.baseline_data}
          selectedAlternativeId={activeAlt?.alternative_id}
          onSelectAlternative={(alt) => {
            setSelectedAlt(alt)
            setActiveTab('3d')
          }}
        />
      )}

      {/* Tab 3: Standards */}
      {activeTab === 'standards' && <StandardsTable evaluationResult={stdResult} />}

      {/* Tab 4: Export */}
      {activeTab === 'export' && (
        <ExportPanel
          projectId={project.project_id}
          alternativeId={activeAlt?.alternative_id || 'alt-1'}
          projectName={project.name}
        />
      )}
    </div>
  )
}
