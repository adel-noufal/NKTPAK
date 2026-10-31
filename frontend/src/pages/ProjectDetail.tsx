import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getProject } from '../api/projects'
import { PackagingViewer3D } from '../components/viewer/PackagingViewer3D'
import { AlternativeComparison } from '../components/optimization/AlternativeComparison'
import { StandardsTable } from '../components/standards/StandardsTable'
import { ExportPanel } from '../components/export/ExportPanel'
import { ComparisonPanel } from '../components/comparison/ComparisonPanel'
import type { PackagingAlternative } from '../types'

type TabId = '3d' | 'comparison' | 'side-by-side' | 'standards' | 'export'

const tabs: { id: TabId; label: string }[] = [
  { id: '3d', label: '3D Workspace' },
  { id: 'comparison', label: 'Alternatives' },
  { id: 'side-by-side', label: 'Comparison' },
  { id: 'standards', label: 'ISO Standards' },
  { id: 'export', label: 'Export' },
]

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<TabId>('3d')
  const [selectedAlt, setSelectedAlt] = useState<PackagingAlternative | null>(null)

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })

  React.useEffect(() => {
    if (project?.optimization_result?.recommended && !selectedAlt) {
      setSelectedAlt(project.optimization_result.recommended)
    }
  }, [project, selectedAlt])

  if (isLoading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p>Loading project…</p>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-6 rounded-lg text-center space-y-3">
        <p className="font-semibold text-sm">Could not load project</p>
        <p className="text-xs">{(error as any)?.message || 'Project not found'}</p>
        <Link to="/" className="inline-block px-4 py-2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs">
          Return to Dashboard
        </Link>
      </div>
    )
  }

  const optResult = project.optimization_result
  const stdResult = project.standards_result
  const alternatives = optResult?.alternatives || []
  const activeAlt = selectedAlt || optResult?.recommended || alternatives[0]
  const isDraft = project.status === 'draft'

  const productData: any = project.product_data || {}
  const productDims = productData.packed_dimensions
    ? {
        length: productData.packed_dimensions.length,
        width: productData.packed_dimensions.width,
        height: productData.packed_dimensions.height,
      }
    : null

  return (
    <div className="space-y-6 pb-16">
      {/* Breadcrumb + header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs">
            <Link to="/projects" className="text-blue-600 dark:text-blue-400 hover:underline">
              Projects
            </Link>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500 truncate max-w-xs">{project.name}</span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-slate-500">
            {productData.model && (
              <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">{productData.model}</span>
            )}
            {productData.weight_kg && (
              <span>Net weight: <strong>{productData.weight_kg} kg</strong></span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold ${
              isDraft
                ? 'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                : 'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
            }`}>
              {isDraft ? 'Draft' : project.status}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('export')}
          className="shrink-0 px-3.5 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export Report
        </button>
      </div>

      {/* Draft banner */}
      {isDraft && (
        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <strong>Draft project — optimization not yet run.</strong>
          <br />
          <span className="text-xs">
            Add the measured dimensions of each packed component to run optimization.
            Component suggestions are listed below.
          </span>
        </div>
      )}

      {/* Optimization highlights — only when results exist */}
      {!isDraft && activeAlt && (
        <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{activeAlt.name}</span>
              {activeAlt.rank === 'RECOMMENDED' && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                  RECOMMENDED CANDIDATE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{activeAlt.description}</p>
          </div>

          <div className="flex flex-wrap gap-3 text-xs font-mono">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md">
              <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Volume utilization</span>
              <span className="text-blue-600 dark:text-blue-400 font-bold">
                {activeAlt.savings.volume_utilization_pct.toFixed(1)}%
              </span>
            </div>
            {activeAlt.savings.savings_status === 'CALCULATED' && activeAlt.savings.material_saved_pct != null ? (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Material saved</span>
                <span className={`font-bold ${activeAlt.savings.material_saved_pct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}`}>
                  {activeAlt.savings.material_saved_pct.toFixed(1)}%
                </span>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-md">
                <span className="block text-[10px] text-slate-400 uppercase tracking-wider mb-0.5">Savings</span>
                <span className="text-amber-600 dark:text-amber-400 font-semibold text-[11px]">Needs baseline</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Result disclaimer */}
      {!isDraft && optResult && (
        <div className="text-[11px] text-slate-400 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded px-3 py-2">
          {optResult.result_warning}
          {' '}Evaluated against: NxtPak ISO registry v1. No company-specific requirements loaded.
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-700 overflow-x-auto text-xs font-medium gap-0.5">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap py-2.5 px-4 border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            {tab.label}
            {tab.id === 'standards' && stdResult && (
              <span className="ms-1.5 px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                {stdResult.results.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab: 3D Workspace */}
      {activeTab === '3d' && (
        <div className="space-y-6">
          {isDraft ? (
            <div className="border border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-10 text-center text-slate-400">
              <p className="text-sm">3D visualization is available after optimization runs.</p>
              <p className="text-xs mt-1">Add component dimensions and re-run optimization.</p>
            </div>
          ) : (
            <PackagingViewer3D alternative={activeAlt} productDims={productDims} />
          )}

          {/* Alternative selector */}
          {alternatives.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Alternatives
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {alternatives.map((alt) => {
                  const isSelected = activeAlt?.alternative_id === alt.alternative_id
                  return (
                    <div
                      key={alt.alternative_id}
                      onClick={() => setSelectedAlt(alt)}
                      className={`p-3 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30'
                          : 'border-slate-200 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-800 dark:text-slate-100">{alt.name}</span>
                        {alt.rank === 'RECOMMENDED' && (
                          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">RECOMMENDED</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {alt.outer_length_mm} × {alt.outer_width_mm} × {alt.outer_height_mm} mm
                      </div>
                      <div className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold mt-0.5">
                        {alt.savings.volume_utilization_pct.toFixed(1)}% utilization
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Alternatives table */}
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

      {/* Tab: Side-by-side comparison */}
      {activeTab === 'side-by-side' && (
        <ComparisonPanel
          baseline={project.baseline_data}
          planned={project.planned_data}
          proposed={activeAlt}
        />
      )}

      {/* Tab: ISO Standards */}
      {activeTab === 'standards' && <StandardsTable evaluationResult={stdResult} />}

      {/* Tab: Export */}
      {activeTab === 'export' && (
        <ExportPanel
          projectId={project.project_id}
          alternativeId={activeAlt?.alternative_id || ''}
          projectName={project.name}
        />
      )}
    </div>
  )
}
