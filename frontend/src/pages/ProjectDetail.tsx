import React, { useState } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getProject, updateProject, reoptimizeProject } from '../api/projects'
import { PackagingViewer3D } from '../components/viewer/PackagingViewer3D'
import { AlternativeComparison } from '../components/optimization/AlternativeComparison'
import { ProjectStandardsCatalog } from '../components/standards/ProjectStandardsCatalog'
import { ExportPanel } from '../components/export/ExportPanel'
import { ComparisonPanel } from '../components/comparison/ComparisonPanel'
import { RecommendationView } from '../components/recommendation/RecommendationView'
import { PRODUCT_TYPES, type FragilityClass, type PackagingAlternative, type ProductType } from '../types'
import { inferProductType } from '../components/viewer/productModel'
import apiClient from '../api/client'

type TabId = '3d' | 'recommendation' | 'comparison' | 'side-by-side' | 'standards' | 'export'

const tabs: { id: TabId; label: string }[] = [
  { id: '3d', label: '3D Workspace' },
  { id: 'recommendation', label: 'AI Recommendation' },
  { id: 'comparison', label: 'Alternatives' },
  { id: 'side-by-side', label: 'Comparison' },
  { id: 'standards', label: 'Standards' },
  { id: 'export', label: 'Export' },
]

export const ProjectDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabId>(
    searchParams.get('tab') === 'recommendation' ? 'recommendation' : '3d',
  )
  const [selectedAlt, setSelectedAlt] = useState<PackagingAlternative | null>(null)
  const [productTypeSaveError, setProductTypeSaveError] = useState<string | null>(null)
  const [editProductForm, setEditProductForm] = useState<Record<string, string> | null>(null)
  const [editProductError, setEditProductError] = useState<string | null>(null)
  const [optimizationStale, setOptimizationStale] = useState(false)
  const queryClient = useQueryClient()

  const { data: project, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => getProject(id!),
    enabled: !!id,
  })
  const { data: standardsCatalog } = useQuery({
    queryKey: ['standards-registry'],
    queryFn: async () => (await apiClient.get('/standards')).data,
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
      <div className="max-w-md mx-auto my-16 p-8 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl shadow-sm text-center space-y-4">
        <div className="w-12 h-12 mx-auto rounded-full bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-500">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-base font-bold text-stone-900 dark:text-stone-100">Project Not Found</h2>
        <p className="text-xs text-stone-500 dark:text-stone-400">
          This project doesn't exist or was deleted.
        </p>
        <div className="pt-2 flex items-center justify-center gap-3">
          <Link
            to="/projects"
            className="px-3.5 py-2 rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-300 transition-colors"
          >
            Go to Projects
          </Link>
          <Link
            to="/projects/new"
            className="px-3.5 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors"
          >
            New Project
          </Link>
        </div>
      </div>
    )
  }

  const optResult = project.optimization_result
  const stdResult = project.standards_result
  const alternatives = optResult?.alternatives || []
  const activeAlt = selectedAlt || optResult?.recommended || alternatives[0]
  const isDraft = project.status === 'draft'

  const productData: any = project.product_data || {}
  const productType = (productData.product_type || inferProductType(`${productData.name || ''} ${project.name} ${project.model_number || ''}`) || 'other') as ProductType
  const fragilityClass = (productData.fragility_class || 'MEDIUM') as FragilityClass
  const optimizationConfig = project.optimization_config || {}
  const requiredClearanceMm = fragilityClass === 'LOW'
    ? optimizationConfig.min_clearance_mm ?? 15
    : fragilityClass === 'MEDIUM'
      ? optimizationConfig.standard_clearance_mm ?? 25
      : optimizationConfig.generous_clearance_mm ?? 40
  const productDims = productData.packed_dimensions && [productData.packed_dimensions.length, productData.packed_dimensions.width, productData.packed_dimensions.height].every((value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0)
    ? {
        length: productData.packed_dimensions.length,
        width: productData.packed_dimensions.width,
        height: productData.packed_dimensions.height,
      }
    : null

  const openProductEditor = () => {
    const dims = productData.packed_dimensions || {}
    setEditProductError(null)
    setEditProductForm({
      name: String(productData.name || project.name || ''),
      weight_kg: String(productData.weight_kg ?? ''),
      length: String(dims.length ?? ''),
      width: String(dims.width ?? ''),
      height: String(dims.height ?? ''),
      product_type: productType,
      shipping_mode: String(productData.shipping_mode || ''),
      components: JSON.stringify(productData.components || [], null, 2),
      foam_design_input: JSON.stringify(productData.foam_design_input || null, null, 2),
    })
  }

  const saveProductEditor = async () => {
    if (!editProductForm) return
    try {
      setEditProductError(null)
      const components = JSON.parse(editProductForm.components)
      if (!Array.isArray(components)) throw new Error('Components must be a JSON array.')
      const foamDesignInput = JSON.parse(editProductForm.foam_design_input || 'null')
      if (foamDesignInput !== null && (typeof foamDesignInput !== 'object' || Array.isArray(foamDesignInput))) {
        throw new Error('Foam design input must be a JSON object or null.')
      }
      const dimensions = { length: Number(editProductForm.length), width: Number(editProductForm.width), height: Number(editProductForm.height), unit: 'mm' }
      if (![dimensions.length, dimensions.width, dimensions.height].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Enter positive product dimensions in millimetres.')
      const weight = Number(editProductForm.weight_kg)
      if (!Number.isFinite(weight) || weight <= 0) throw new Error('Enter a product weight greater than zero.')
      const nextProductData = { ...productData, name: editProductForm.name, weight_kg: weight, product_type: editProductForm.product_type, shipping_mode: editProductForm.shipping_mode || null, packed_dimensions: dimensions, components, foam_design_input: foamDesignInput }
      await updateProject(project.project_id, { product_data: nextProductData })
      queryClient.setQueryData(['project', id], (current: any) => ({ ...current, product_data: nextProductData, components_data: components }))
      setEditProductForm(null)
      setOptimizationStale(true)
      if (window.confirm('Product data saved. Re-run optimization now to refresh packaging results?')) {
        await reoptimizeProject(project.project_id)
        await queryClient.invalidateQueries({ queryKey: ['project', id] })
        setOptimizationStale(false)
      }
    } catch (err) {
      setEditProductError(err instanceof Error ? err.message : 'Could not save product data.')
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {editProductForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-product-title">
          <form onSubmit={(event) => { event.preventDefault(); void saveProductEditor() }} className="max-h-[90vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-xl border border-stone-300 bg-white p-6 shadow-xl dark:border-stone-700 dark:bg-stone-900">
            <h2 id="edit-product-title" className="text-base font-bold">Edit product data</h2>
            <div className="grid grid-cols-2 gap-3">
              {([['Product name','name'],['Weight (kg)','weight_kg'],['Length (mm)','length'],['Width (mm)','width'],['Height (mm)','height']] as const).map(([label,key]) => (
                <label key={key} className="space-y-1 text-xs"><span>{label}</span><input required type="number" step="any" value={editProductForm[key]} onChange={(event) => setEditProductForm({ ...editProductForm, [key]: event.target.value })} className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 dark:border-stone-700 dark:bg-stone-800" /></label>
              ))}
              <label className="space-y-1 text-xs"><span>Product type</span><select value={editProductForm.product_type} onChange={(event) => setEditProductForm({ ...editProductForm, product_type: event.target.value })} className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 capitalize dark:border-stone-700 dark:bg-stone-800">{PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type.replace(/_/g,' ')}</option>)}</select></label>
              <label className="space-y-1 text-xs"><span>Shipping mode</span><select value={editProductForm.shipping_mode} onChange={(event) => setEditProductForm({ ...editProductForm, shipping_mode: event.target.value })} className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 dark:border-stone-700 dark:bg-stone-800"><option value="">Not specified</option><option value="courier_parcel">Courier / parcel</option><option value="ltl_pallet">LTL pallet</option><option value="full_truck">Full truckload</option><option value="container">Container</option><option value="ecommerce_marketplace">E-commerce marketplace</option></select></label>
            </div>
            <label className="block space-y-1 text-xs"><span>Product components (JSON array)</span><textarea rows={7} value={editProductForm.components} onChange={(event) => setEditProductForm({ ...editProductForm, components: event.target.value })} className="w-full rounded border border-stone-300 bg-white p-2 font-mono text-xs dark:border-stone-700 dark:bg-stone-800" /></label>
            <label className="block space-y-1 text-xs"><span>Supplier-backed foam design inputs (JSON object or null)</span><textarea rows={8} value={editProductForm.foam_design_input} onChange={(event) => setEditProductForm({ ...editProductForm, foam_design_input: event.target.value })} placeholder={'{"material": {...}, "supports": [...], "drop_height_mm": ..., "fragility_limit_g": ..., "safety_factor": ...}'} className="w-full rounded border border-stone-300 bg-white p-2 font-mono text-xs dark:border-stone-700 dark:bg-stone-800" /><span className="text-[10px] text-stone-500">Use an enabled material record and measured support areas. Missing curves do not produce a calculated thickness.</span></label>
            {editProductError && <p role="alert" className="text-xs text-rose-600">{editProductError}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditProductForm(null)} className="rounded border px-3 py-2 text-xs">Cancel</button><button type="submit" className="rounded bg-blue-700 px-3 py-2 text-xs font-semibold text-white">Save product data</button></div>
          </form>
        </div>
      )}
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

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('recommendation')}
            className="shrink-0 px-3.5 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Get AI Recommendation
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className="shrink-0 px-3.5 py-2 rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </button>
        </div>
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
          {' '}{standardsCatalog?.evaluation_statement || 'Loading ISO and ISTA registry metadata…'}
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
              {productDims ? <><p className="text-sm">3D visualization is available after optimization runs.</p><p className="text-xs mt-1">Add component dimensions and re-run optimization.</p></> : <p role="alert" data-testid="missing-dimensions-message">Product dimensions are missing — enter them</p>}
              <button type="button" onClick={openProductEditor} className="mt-3 rounded bg-amber-700 px-4 py-2 text-xs font-semibold text-white">Edit product dimensions</button>
            </div>
          ) : (
            <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex flex-wrap items-center gap-2 text-xs text-stone-600 dark:text-stone-300">
              <span>Product type</span>
              <select
                data-testid="project-product-type-select"
                value={productType}
                onChange={async (event) => {
                  const nextType = event.target.value as ProductType
                  const nextProductData = { ...productData, product_type: nextType, product_type_provenance: { source_name: 'User entered', source_type: 'USER_ENTERED', is_edited: true } }
                  try {
                    setProductTypeSaveError(null)
                    await updateProject(project.project_id, { product_data: nextProductData })
                    queryClient.setQueryData(['project', id], { ...project, product_data: nextProductData })
                  } catch (err) {
                    setProductTypeSaveError(err instanceof Error ? err.message : 'Could not save product type')
                  }
                }}
                className="rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 px-2 py-1 capitalize"
              >
                {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type.split('_').join(' ')}</option>)}
              </select>
              <span>Source: {productData.product_type_provenance?.source_name || (productData.product_type ? 'Saved project data' : 'Inferred from product name')}</span>
            </label>
            <button type="button" onClick={openProductEditor} className="rounded border border-stone-300 px-3 py-1.5 text-xs font-semibold dark:border-stone-700">Edit product data</button>
            </div>
            {optimizationStale && <p role="status" className="text-xs text-amber-700">Product data saved. Re-run optimization to refresh packaging results.</p>}
            {productTypeSaveError && <p role="alert" className="text-xs text-rose-600">{productTypeSaveError}</p>}
            <PackagingViewer3D
              alternative={activeAlt}
              productDims={productDims}
              category={project.product_data?.category || null}
              productName={project.name}
              modelProject={{ ...productData, product_type: productType }}
              fragilityClass={fragilityClass}
              requiredClearanceMm={requiredClearanceMm}
              components={Array.isArray(productData.components) ? productData.components : []}
              onEditProduct={openProductEditor}
              onAddParts={openProductEditor}
              images={(project.product_data as any)?.images || ((project.product_data as any)?.image_url ? [(project.product_data as any).image_url] : [])}
            />
            </div>
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

      {/* Tab: AI Recommendation */}
      {activeTab === 'recommendation' && (
        <RecommendationView
          projectId={project.project_id}
          productDims={productDims}
          components={Array.isArray(productData.components) ? productData.components : []}
          images={(project.product_data as any)?.images || ((project.product_data as any)?.image_url ? [(project.product_data as any).image_url] : [])}
          modelProject={{ ...productData, product_type: productType }}
          fragilityClass={fragilityClass}
          requiredClearanceMm={requiredClearanceMm}
        />
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
      {activeTab === 'standards' && <ProjectStandardsCatalog projectId={project.project_id} evaluationResult={stdResult} />}

      {/* Tab: Export */}
      {activeTab === 'export' && (
        <ExportPanel
          projectId={project.project_id}
          alternativeId={activeAlt?.alternative_id || ''}
          projectName={project.name}
          hasOptimization={Boolean(activeAlt && alternatives.length > 0)}
          hasProductDimensions={Boolean(productDims)}
        />
      )}
    </div>
  )
}
