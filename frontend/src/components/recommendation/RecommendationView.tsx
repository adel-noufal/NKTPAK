import React, { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getProjectRecommendation,
  generateProjectRecommendation,
  refineProjectRecommendation,
  acceptRecommendationCandidate,
  submitRecommendationFeedback,
  reasonProjectRecommendation,
} from '../../api/projects'
import type { FragilityClass, RecommendationRun, RecommendedCandidate } from '../../types'
import { PackagingViewer3D } from '../viewer/PackagingViewer3D'
import type { ProductModelProject } from '../viewer/productModel'
import { useProjectStore } from '../../store/projectStore'
import { useTranslation } from 'react-i18next'

interface RecommendationViewProps {
  projectId: string
  productDims?: { length: number; width: number; height: number } | null
  components?: any[]
  images?: string[]
  modelProject: ProductModelProject
  fragilityClass: FragilityClass
  requiredClearanceMm: number
}

export const RecommendationView: React.FC<RecommendationViewProps> = ({
  projectId,
  productDims,
  components = [],
  images = [],
  modelProject,
  fragilityClass,
  requiredClearanceMm,
}) => {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { setSelectedView } = useProjectStore()
  const reasoningStarted = useRef(false)
  const [refinementInput, setRefinementInput] = useState('')
  const [activeVisual, setActiveVisual] = useState<'3d' | 'packout' | 'pallet' | 'dieline'>('3d')
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null)
  const [reasoningPending, setReasoningPending] = useState(false)
  const [reasoningError, setReasoningError] = useState<string | null>(null)

  const { data: run, isLoading, error } = useQuery<RecommendationRun>({
    queryKey: ['recommendation', projectId],
    queryFn: () => getProjectRecommendation(projectId),
    enabled: !!projectId,
  })

  useEffect(() => {
    setSelectedView('inside')
  }, [setSelectedView])

  useEffect(() => {
    if (!run || run.is_ai_reasoned || reasoningStarted.current) return
    reasoningStarted.current = true
    setReasoningPending(true)
    void reasonProjectRecommendation(projectId)
      .then((reasonedRun) => {
        queryClient.setQueryData(['recommendation', projectId], reasonedRun)
        setReasoningPending(false)
      })
      .catch((err: unknown) => {
        setReasoningError(err instanceof Error ? err.message : 'AI reasoning request failed.')
        setReasoningPending(false)
      })
  }, [projectId, queryClient, run])

  const regenMutation = useMutation({
    mutationFn: () => generateProjectRecommendation(projectId),
    onSuccess: (data) => {
      queryClient.setQueryData(['recommendation', projectId], data)
    },
  })

  const refineMutation = useMutation({
    mutationFn: (prompt: string) => refineProjectRecommendation(projectId, prompt),
    onSuccess: (data) => {
      queryClient.setQueryData(['recommendation', projectId], data)
      setRefinementInput('')
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (candId: string) => acceptRecommendationCandidate(projectId, candId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      queryClient.invalidateQueries({ queryKey: ['recommendation', projectId] })
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: (params: { status: 'accepted' | 'rejected'; reason?: string }) =>
      submitRecommendationFeedback(projectId, params.status, params.reason),
    onSuccess: (_, vars) => {
      setFeedbackSuccess(vars.status === 'accepted' ? 'Recommendation accepted and saved to project records.' : 'Feedback recorded.')
      setShowRejectModal(false)
      queryClient.invalidateQueries({ queryKey: ['recommendation', projectId] })
    },
  })

  if (isLoading) {
    return (
      <div className="py-20 text-center text-stone-500 text-xs space-y-3">
        <div className="inline-block w-6 h-6 border-2 border-stone-700 dark:border-stone-300 border-t-transparent rounded-full animate-spin" />
        <p>Generating engineering-verified packaging recommendation…</p>
      </div>
    )
  }

  if (error || !run) {
    return (
      <div className="p-6 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 text-center space-y-3">
        <p className="font-semibold">Could not load AI recommendation</p>
        <p>{(error as any)?.message || 'An error occurred.'}</p>
        <button
          type="button"
          onClick={() => regenMutation.mutate()}
          className="px-3.5 py-1.5 rounded bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 font-medium"
        >
          Retry Calculation
        </button>
      </div>
    )
  }

  const rec = run.recommended
  const curveBackedThickness = rec.foam_design?.status === 'CURVE_EVALUATED'
    ? rec.foam_design.selected_thickness_mm
    : null

  // Build alternative object for PackagingViewer3D
  const viewerAlt = {
    id: rec.candidate_id,
    name: rec.name,
    outer_length_mm: rec.carton_length_mm,
    outer_width_mm: rec.carton_width_mm,
    outer_height_mm: rec.carton_height_mm,
    insert_thickness_mm: curveBackedThickness ?? 0,
    board_thickness_mm: rec.board_thickness_mm,
    foam_material: curveBackedThickness != null ? rec.foam_design?.material_name : undefined,
  } as any

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              AI Packaging Recommendation
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              {run.is_ai_reasoned
                ? `Engine-calculated & reasoned via ${run.model_name}`
                : 'Calculated, without AI reasoning (deterministic engine active)'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => regenMutation.mutate()}
            disabled={regenMutation.isPending}
            className="text-xs px-3 py-1.5 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 hover:bg-stone-50 dark:hover:bg-stone-750 font-medium text-stone-700 dark:text-stone-300 transition-colors disabled:opacity-50"
          >
            {regenMutation.isPending ? 'Regenerating…' : 'Recompute Candidates'}
          </button>
        </div>
      </div>

      {feedbackSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300">
          ✓ {feedbackSuccess}
        </div>
      )}

      {/* ── 1. Recommended Design Card ─────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm space-y-6">
        {/* Card Header & Headline Metrics */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-stone-100 dark:border-stone-800">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base font-bold text-stone-900 dark:text-stone-100">
                {rec.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-300">
                {rec.badge}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                run.confidence_level === 'High'
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                  : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}>
                {run.confidence_level} Confidence
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {rec.board_grade} ({rec.board_thickness_mm} mm) · {curveBackedThickness != null
                ? `${rec.foam_design?.material_name || 'Supplier material'} (${curveBackedThickness} mm)`
                : t('recommendation.foamNoCurve', 'No curve-backed thickness calculated')}
            </p>
          </div>

          {/* Metric Badges */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-stone-400">Material Saved</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{rec.material_savings_pct.toFixed(1)}%</span>
            </div>
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-stone-400">Volume Saved</span>
              <span className="font-bold text-blue-600 dark:text-blue-400">{rec.volume_savings_pct.toFixed(1)}%</span>
            </div>
            {rec.cost_savings_pct != null && (
              <div className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
                <span className="block text-[9px] uppercase tracking-wider text-stone-400">Cost Saved/1k</span>
                <span className="font-bold text-stone-800 dark:text-stone-200">{rec.cost_savings_per_1000_units?.toFixed(0)} {rec.currency}</span>
              </div>
            )}
            <div className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700 text-center">
              <span className="block text-[9px] uppercase tracking-wider text-stone-400">BCT Safety Factor</span>
              <span className="font-bold text-stone-800 dark:text-stone-200">{rec.safety_factor.toFixed(2)}x</span>
            </div>
          </div>
        </div>

        {/* Engineering Justification (3-5 sentences) */}
        <div className="p-4 rounded-lg bg-stone-50/70 dark:bg-stone-800/50 border border-stone-200/80 dark:border-stone-700/80 text-xs leading-relaxed text-stone-800 dark:text-stone-200 space-y-1">
          <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5 mb-1 text-[11px]">
            <svg className="w-3.5 h-3.5 text-stone-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Engineering Rationale
          </div>
          <p className="whitespace-pre-wrap">{run.explanation}</p>
          {reasoningPending && <p role="status" className="mt-2 text-[10px] text-teal-700 dark:text-teal-300">{t('recommendation.aiReasoningPending', 'AI reasoning is being generated separately from the calculated result…')}</p>}
          {reasoningError && (
            <p role="alert" className="mt-2 text-[10px] text-rose-700 dark:text-rose-300">
              AI reasoning unavailable: {reasoningError}
              <button type="button" className="ms-2 underline" onClick={() => {
                reasoningStarted.current = false
                setReasoningError(null)
                void reasonProjectRecommendation(projectId)
                  .then((reasonedRun) => queryClient.setQueryData(['recommendation', projectId], reasonedRun))
                  .catch((err: unknown) => setReasoningError(err instanceof Error ? err.message : 'AI reasoning request failed.'))
              }}>Retry</button>
            </p>
          )}
        </div>

        {rec.foam_design && (
          <section aria-label="Foam cushioning calculation" className="rounded-lg border border-teal-200 bg-teal-50/60 p-4 text-xs dark:border-teal-900 dark:bg-teal-950/20">
            <h3 className="font-semibold text-stone-900 dark:text-stone-100">{t('recommendation.foamTitle', 'Foam / cushioning calculation')}</h3>
            <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">{rec.foam_design.calculation_label}</p>
            <p className="mt-2 font-medium">
              {rec.foam_design.status === 'CURVE_EVALUATED' && rec.foam_design.selected_thickness_mm != null
                ? `${rec.foam_design.material_name || 'Supplier material'} · ${rec.foam_design.selected_thickness_mm} mm · ${rec.foam_design.estimated_peak_deceleration_g} G estimated peak`
                : t('recommendation.foamNoCurve', 'No curve-backed thickness calculated')}
            </p>
            {rec.foam_design.foam_volume_mm3 != null && (
              <p className="mt-1 text-[11px] text-stone-600 dark:text-stone-300">
                {t('recommendation.foamVolume', 'Foam volume')}: {(rec.foam_design.foam_volume_mm3 / 1_000_000).toFixed(3)} L
                {rec.foam_design.foam_weight_kg != null ? ` · ${rec.foam_design.foam_weight_kg.toFixed(3)} kg` : ''}
                {rec.foam_design.foam_cost != null ? ` · ${rec.foam_design.foam_cost.toFixed(2)} (configured material cost)` : ` · ${t('recommendation.foamCostUnavailable', 'Cost not available — enter material cost')}`}
              </p>
            )}
            {rec.foam_design.supports.length > 0 && (
              <ul className="mt-2 space-y-1 text-stone-600 dark:text-stone-300">
                {rec.foam_design.supports.map((support) => (
                  <li key={support.name}>{support.name}: {support.carried_weight_kg} kg ÷ {support.bearing_area_mm2} mm² = {support.static_stress_kpa.toFixed(3)} kPa static stress</li>
                ))}
              </ul>
            )}
            {rec.foam_design.warnings.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 ps-4 text-amber-800 dark:text-amber-300">
                {rec.foam_design.warnings.map((warning) => (
                  <li key={warning}>
                    {i18n.language.startsWith('ar') && warning.startsWith('No cushion curve')
                      ? t('recommendation.foamNoCurveWarning', warning)
                      : warning}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Specs Table Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-2.5 rounded bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
            <span className="text-[10px] text-stone-400 block mb-0.5">Carton Dimensions</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
              {rec.carton_length_mm} × {rec.carton_width_mm} × {rec.carton_height_mm} mm
            </span>
          </div>

          <div className="p-2.5 rounded bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
            <span className="text-[10px] text-stone-400 block mb-0.5">McKee Strength (BCT)</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
              {rec.bct_kgf} kgf ({rec.bct_newtons} N)
            </span>
          </div>

          <div className="p-2.5 rounded bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
            <span className="text-[10px] text-stone-400 block mb-0.5">Euro Pallet Stacking</span>
            <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
              {rec.cartons_per_layer}/layer · {rec.units_per_pallet} total ({rec.pallet_utilization_pct}%)
            </span>
          </div>

          <div className="p-2.5 rounded bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/60">
            <span className="text-[10px] text-stone-400 block mb-0.5">Inserts / Cushions</span>
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              {curveBackedThickness != null
                ? `${rec.foam_design?.material_name || 'Supplier material'} (${curveBackedThickness} mm)`
                : t('recommendation.foamNoCurve', 'No curve-backed thickness calculated')}
            </span>
          </div>
        </div>

        {/* Assumptions & Missing Data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[11px] pt-1">
          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-1">
            <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
              Engineering Assumptions
            </span>
            <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-400">
              {run.assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>

          <div className="p-3 rounded-lg border border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-950/40 space-y-1">
            <span className="font-bold text-stone-700 dark:text-stone-300 block mb-1">
              Suggested Physical Test Plan (ISO/ISTA)
            </span>
            <ul className="list-disc list-inside space-y-1 text-stone-600 dark:text-stone-400">
              {run.test_plan.map((tp, i) => (
                <li key={i}>{tp}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Feedback & Accept Buttons */}
        <div className="pt-2 flex items-center justify-between border-t border-stone-100 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => feedbackMutation.mutate({ status: 'accepted' })}
              disabled={feedbackMutation.isPending}
              className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors"
            >
              ✓ Accept This Design
            </button>
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              className="px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors"
            >
              Reject with reason
            </button>
          </div>

          <span className="text-[10px] text-stone-400">
            Physical lab testing required before series production
          </span>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="p-4 rounded-xl bg-stone-50 dark:bg-stone-900 border border-stone-300 dark:border-stone-700 space-y-3">
          <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">State Reason for Rejection</h4>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={2}
            placeholder="e.g., Target unit cost is below 15 EGP, or need higher pallet stacking..."
            className="w-full text-xs p-2 rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setShowRejectModal(false)}
              className="text-xs px-3 py-1.5 rounded text-stone-500 hover:underline"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => feedbackMutation.mutate({ status: 'rejected', reason: rejectReason })}
              className="text-xs px-3 py-1.5 rounded bg-rose-600 text-white font-medium"
            >
              Submit Rejection
            </button>
          </div>
        </div>
      )}

      {/* ── 2. Visual Design & Packout Studio ───────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            Visual Packing Design & Pack-out Studio
          </h3>
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveVisual('3d')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeVisual === '3d'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              3D Inside View
            </button>
            <button
              type="button"
              onClick={() => setActiveVisual('packout')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeVisual === 'packout'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Pack-Out Sequence
            </button>
            <button
              type="button"
              onClick={() => setActiveVisual('pallet')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeVisual === 'pallet'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Euro Pallet Layout
            </button>
            <button
              type="button"
              onClick={() => setActiveVisual('dieline')}
              className={`px-3 py-1 rounded-md transition-colors ${
                activeVisual === 'dieline'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Flat Dieline
            </button>
          </div>
        </div>

        {/* 3D View */}
        {activeVisual === '3d' && (
          <PackagingViewer3D
            alternative={viewerAlt}
            productDims={productDims}
            category={rec.name}
            productName={rec.name}
            components={components}
            images={images}
            modelProject={modelProject}
            fragilityClass={fragilityClass}
            requiredClearanceMm={requiredClearanceMm}
          />
        )}

        {/* Pack-out Sequence */}
        {activeVisual === 'packout' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {rec.packout_steps.map((step) => (
              <div
                key={step.step_number}
                className="p-4 rounded-xl bg-stone-50 dark:bg-stone-800/40 border border-stone-200 dark:border-stone-700/80 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="w-6 h-6 rounded-full bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 flex items-center justify-center font-bold text-xs">
                    {step.step_number}
                  </span>
                  <span className="text-[10px] text-stone-400 font-mono">Step {step.step_number} of 4</span>
                </div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  {step.title}
                </h4>
                <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                  {step.description}
                </p>
                <div className="text-[10px] text-stone-400 pt-1 border-t border-stone-200 dark:border-stone-700/60 font-medium">
                  {step.component_involved}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pallet View */}
        {activeVisual === 'pallet' && (
          <div className="p-6 rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700/80 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  Euro Pallet 1200 × 800 mm Pattern
                </h4>
                <p className="text-[11px] text-stone-500">
                  {rec.cartons_per_layer} cartons per layer · {rec.layer_count} vertical layers · {rec.units_per_pallet} total units
                </p>
              </div>
              <div className="flex gap-4 font-mono text-xs">
                <div>
                  <span className="text-[10px] text-stone-400 block">Stacking Height</span>
                  <span className="font-bold">{rec.stacking_height_mm} mm</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Area Utilization</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{rec.pallet_utilization_pct}%</span>
                </div>
                <div>
                  <span className="text-[10px] text-stone-400 block">Overhang</span>
                  <span className="font-bold">{rec.pallet_overhang_mm} mm</span>
                </div>
              </div>
            </div>

            {/* Visual Pallet Grid Diagram */}
            <div className="w-full h-44 bg-stone-200 dark:bg-stone-800 rounded-lg p-2 flex items-center justify-center border border-stone-300 dark:border-stone-700 relative overflow-hidden">
              <div className="w-64 h-36 bg-amber-100 dark:bg-amber-950/40 border-2 border-amber-500 rounded flex flex-wrap p-1 gap-1 items-center justify-center shadow-inner">
                {Array.from({ length: rec.cartons_per_layer }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 min-w-[50px] h-14 bg-amber-500/80 border border-amber-600 rounded flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                  >
                    #{i + 1}
                  </div>
                ))}
              </div>
              <div className="absolute bottom-1 end-2 text-[9px] text-stone-500 font-mono">
                1200 × 800 mm footprint
              </div>
            </div>
          </div>
        )}

        {/* Flat Dieline */}
        {activeVisual === 'dieline' && (
          <div className="p-6 rounded-xl bg-stone-50 dark:bg-stone-800/30 border border-stone-200 dark:border-stone-700/80 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-stone-900 dark:text-stone-100">
                  FEFCO 0201 Regular Slotted Carton (RSC) Flat Dieline
                </h4>
                <p className="text-[11px] text-stone-500">
                  Calculated blank size: {(2 * rec.carton_length_mm + 2 * rec.carton_width_mm + 40).toFixed(0)} × {(rec.carton_height_mm + rec.carton_width_mm + 10).toFixed(0)} mm ({rec.carton_board_area_m2.toFixed(3)} m²)
                </p>
              </div>
              <span className="text-[10px] font-mono px-2 py-1 rounded bg-stone-200 dark:bg-stone-700 text-stone-700 dark:text-stone-300">
                Separated CUT & CREASE
              </span>
            </div>

            {/* Dieline representation */}
            <div className="w-full h-44 bg-white dark:bg-stone-950 rounded-lg border border-stone-300 dark:border-stone-700 p-4 flex items-center justify-center font-mono text-xs">
              <div className="w-80 h-32 border-2 border-dashed border-stone-400 rounded flex flex-col justify-between p-2 relative">
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>Flap 1 (L={rec.carton_length_mm})</span>
                  <span>Flap 2 (W={rec.carton_width_mm})</span>
                  <span>Flap 3</span>
                  <span>Flap 4</span>
                </div>
                <div className="text-center font-bold text-stone-700 dark:text-stone-300">
                  Body Panels · H = {rec.carton_height_mm} mm
                </div>
                <div className="flex justify-between text-[10px] text-stone-400">
                  <span>Bottom Flaps</span>
                  <span className="text-amber-500">35 mm Glue Tab</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. Viable Alternatives Comparison ────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
          Viable Packaging Alternatives ({run.alternatives.length} options)
        </h3>
        <p className="text-[11px] text-stone-500">
          Compare alternative trade-offs. Click "Use this design" to switch the project's active specification.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border border-stone-200 dark:border-stone-800 rounded-lg overflow-hidden">
            <thead className="bg-stone-50 dark:bg-stone-800/60 text-stone-500 text-[11px] font-bold uppercase tracking-wider">
              <tr>
                <th className="py-2.5 px-3 text-start">Alternative</th>
                <th className="py-2.5 px-3 text-start">Dimensions (mm)</th>
                <th className="py-2.5 px-3 text-start">Board & ECT</th>
                <th className="py-2.5 px-3 text-start">McKee BCT</th>
                <th className="py-2.5 px-3 text-start">Safety Factor</th>
                <th className="py-2.5 px-3 text-start">Pallet Fit</th>
                <th className="py-2.5 px-3 text-start">Material Saved</th>
                <th className="py-2.5 px-3 text-end">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-mono">
              {run.alternatives.map((alt) => (
                <tr key={alt.candidate_id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/40 transition-colors">
                  <td className="py-3 px-3 font-sans font-semibold text-stone-900 dark:text-stone-100">
                    <div>{alt.name}</div>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-500 font-mono">
                      {alt.badge}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    {alt.carton_length_mm} × {alt.carton_width_mm} × {alt.carton_height_mm}
                  </td>
                  <td className="py-3 px-3 font-sans text-[11px]">
                    {alt.board_grade} ({alt.ect_kn_m} kN/m)
                  </td>
                  <td className="py-3 px-3">
                    {alt.bct_kgf} kgf
                  </td>
                  <td className="py-3 px-3">
                    {alt.safety_factor}x
                  </td>
                  <td className="py-3 px-3">
                    {alt.cartons_per_layer}/layer ({alt.units_per_pallet} total)
                  </td>
                  <td className="py-3 px-3 text-emerald-600 dark:text-emerald-400 font-bold">
                    {alt.material_savings_pct.toFixed(1)}%
                  </td>
                  <td className="py-3 px-3 text-end font-sans">
                    <button
                      type="button"
                      onClick={() => acceptMutation.mutate(alt.candidate_id)}
                      disabled={acceptMutation.isPending}
                      className="px-2.5 py-1 rounded bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 text-[11px] font-medium shadow-sm hover:bg-stone-700 dark:hover:bg-stone-100 transition-colors disabled:opacity-50"
                    >
                      Use this design
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 4. Why Not Others? (Rejected Candidates) ───────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
          Why Not Other Designs? (Rejected Candidates)
        </h3>
        <p className="text-[11px] text-stone-500">
          Every candidate is evaluated against physical safety thresholds. The following designs were rejected:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {run.rejected_candidates.map((rej, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 space-y-2 text-xs"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100">{rej.name}</span>
                <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 font-semibold">REJECTED</span>
              </div>
              <div className="text-[11px] font-mono text-stone-500">
                {rej.carton_length_mm} × {rej.carton_width_mm} × {rej.carton_height_mm} mm
              </div>
              <div className="p-2 rounded bg-white dark:bg-stone-900 border border-rose-200/80 dark:border-rose-900/40 text-[11px] text-rose-700 dark:text-rose-300 font-medium">
                ✗ {rej.failed_check}
              </div>
              <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
                {rej.explanation}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 5. Refinement & Constraint Tuning Chatbox ────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-sm space-y-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
            Refine & Tune Constraints
          </h3>
          <p className="text-[11px] text-stone-500">
            Instruct the engine to adjust design priorities. The engine re-computes candidates deterministically and re-evaluates trade-offs.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (refinementInput.trim()) refineMutation.mutate(refinementInput.trim())
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <input
              type="text"
              value={refinementInput}
              onChange={(e) => setRefinementInput(e.target.value)}
              placeholder="e.g. 'make it cheaper', 'must fit 8 per pallet layer', 'protect the motor more'..."
              className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-500"
              disabled={refineMutation.isPending}
            />
            <button
              type="submit"
              disabled={refineMutation.isPending || !refinementInput.trim()}
              className="px-4 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold disabled:opacity-40 transition-colors shrink-0"
            >
              {refineMutation.isPending ? 'Re-optimizing…' : 'Refine'}
            </button>
          </div>

          {/* Quick preset chips */}
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-stone-400 font-medium">Quick Prompts:</span>
            {[
              'Make it cheaper',
              'Maximum drop protection',
              'Fit 8 per pallet layer',
              'Use 5-ply board only',
            ].map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => refineMutation.mutate(qp)}
                className="px-2 py-0.5 rounded border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-400 transition-colors"
              >
                {qp}
              </button>
            ))}
          </div>
        </form>

        {/* Refinement History */}
        {run.refinement_history && run.refinement_history.length > 0 && (
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Refinement History
            </span>
            <div className="space-y-1">
              {run.refinement_history.map((rh, i) => (
                <div key={i} className="text-[11px] text-stone-500 flex items-center justify-between">
                  <span>"{rh.prompt}"</span>
                  <span className="text-stone-400 text-[10px] font-mono">
                    {rh.recommended_candidate || 'Applied'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
export default RecommendationView
