import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createProject } from '../api/projects'
import { FragilityClass, ProjectCreate } from '../types'

export const NewProject: React.FC = () => {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step state (1: Product, 2: Baseline, 3: Clearances)
  const [step, setStep] = useState<number>(1)

  // Product Fields
  const [name, setName] = useState('Stand Fan Packaging Project')
  const [category, setCategory] = useState('Home Appliances')
  const [length, setLength] = useState<number>(500)
  const [width, setWidth] = useState<number>(400)
  const [height, setHeight] = useState<number>(1250)
  const [unit, setUnit] = useState<'mm' | 'cm' | 'inch'>('mm')
  const [weightKg, setWeightKg] = useState<number>(6.5)
  const [fragility, setFragility] = useState<FragilityClass>(FragilityClass.MEDIUM)

  // Baseline Fields (Optional)
  const [includeBaseline, setIncludeBaseline] = useState(true)
  const [baseOuterL, setBaseOuterL] = useState<number>(570)
  const [baseOuterW, setBaseOuterW] = useState<number>(480)
  const [baseOuterH, setBaseOuterH] = useState<number>(1320)
  const [baseBoardTh, setBaseBoardTh] = useState<number>(5)
  const [baseBoardType, setBaseBoardType] = useState('Double wall corrugated')
  const [baseUnitCost, setBaseUnitCost] = useState<number>(18.5)
  const [baseCurrency, setBaseCurrency] = useState('EGP')

  // Optimization Config
  const [minClearance, setMinClearance] = useState<number>(15)
  const [stdClearance, setStdClearance] = useState<number>(25)
  const [generousClearance, setGenerousClearance] = useState<number>(40)
  const [boardThickness, setBoardThickness] = useState<number>(4)
  const [insertThickness, setInsertThickness] = useState<number>(25)

  // Quick Preset Handlers
  const handleApplyPreset = (presetType: 'fan' | 'blender' | 'electronics') => {
    if (presetType === 'fan') {
      setName('Stand Fan Packaging Project')
      setCategory('Home Appliances')
      setLength(500)
      setWidth(400)
      setHeight(1250)
      setWeightKg(6.5)
      setFragility(FragilityClass.MEDIUM)
      setBaseOuterL(570)
      setBaseOuterW(480)
      setBaseOuterH(1320)
    } else if (presetType === 'blender') {
      setName('Table Blender Packaging Project')
      setCategory('Kitchen Appliances')
      setLength(230)
      setWidth(230)
      setHeight(420)
      setWeightKg(2.8)
      setFragility(FragilityClass.HIGH)
      setBaseOuterL(300)
      setBaseOuterW(300)
      setBaseOuterH(450)
    } else {
      setName('Electronics Packaging Project')
      setCategory('Consumer Electronics')
      setLength(350)
      setWidth(250)
      setHeight(80)
      setWeightKg(1.4)
      setFragility(FragilityClass.HIGH)
      setBaseOuterL(420)
      setBaseOuterW(320)
      setBaseOuterH(140)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Convert dimensions to mm if cm/inch selected
    const factor = unit === 'cm' ? 10 : unit === 'inch' ? 25.4 : 1.0
    const finalL = length * factor
    const finalW = width * factor
    const finalH = height * factor

    if (finalL <= 0 || finalW <= 0 || finalH <= 0 || weightKg <= 0) {
      setError('Please ensure dimensions and weight are greater than zero.')
      return
    }

    const payload: ProjectCreate = {
      name,
      description: `Packaging optimization for ${name}`,
      language: 'en',
      product: {
        name,
        category,
        packed_dimensions: {
          length: finalL,
          width: finalW,
          height: finalH,
          unit: 'mm',
        },
        weight_kg: weightKg,
        fragility_class: fragility,
        provenance: {
          source_name: 'User manual input',
          data_label: 'USER ENTERED',
        },
      },
      baseline: includeBaseline
        ? {
            carton_outer_length_mm: baseOuterL,
            carton_outer_width_mm: baseOuterW,
            carton_outer_height_mm: baseOuterH,
            board_thickness_mm: baseBoardTh,
            board_type: baseBoardType,
            carton_cost_per_unit: baseUnitCost,
            currency: baseCurrency,
            data_label: 'USER ENTERED',
          }
        : undefined,
      optimization_config: {
        min_clearance_mm: minClearance,
        standard_clearance_mm: stdClearance,
        generous_clearance_mm: generousClearance,
        board_thickness_mm: boardThickness,
        insert_thickness_mm: insertThickness,
      },
    }

    try {
      setSubmitting(true)
      const res = await createProject(payload)
      navigate(`/projects/${res.project_id}`)
    } catch (err: any) {
      setError(err.message || 'Failed to create project')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 flex items-center gap-2">
          📦 New Packaging Optimization
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Enter product dimensions and optionally your current packaging to compute material and cost savings.
        </p>
      </div>

      {/* Preset Buttons for Instant Testing */}
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-slate-400 font-medium">Quick Presets:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleApplyPreset('fan')}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            💨 Stand Fan
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('blender')}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            🥤 Table Blender
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('electronics')}
            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            💻 Electronics
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/40 text-rose-300 p-4 rounded-xl text-xs font-medium">
          ⚠️ {error}
        </div>
      )}

      {/* Step Tabs */}
      <div className="flex border-b border-slate-800 text-xs font-semibold">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`py-3 px-5 border-b-2 transition-all ${
            step === 1
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          1. Product Dimensions
        </button>
        <button
          type="button"
          onClick={() => setStep(2)}
          className={`py-3 px-5 border-b-2 transition-all ${
            step === 2
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          2. Baseline (Optional)
        </button>
        <button
          type="button"
          onClick={() => setStep(3)}
          className={`py-3 px-5 border-b-2 transition-all ${
            step === 3
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          3. Clearances & Rules
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Product Specifications */}
        {step === 1 && (
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200 mb-2">Product Information</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Project / Product Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Category</label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-200">
                  Outer Packed Dimensions
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as any)}
                  className="bg-slate-800 text-xs text-slate-200 rounded px-2 py-1 border border-slate-700"
                >
                  <option value="mm">Millimeters (mm)</option>
                  <option value="cm">Centimeters (cm)</option>
                  <option value="inch">Inches (in)</option>
                </select>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Length</span>
                  <input
                    type="number"
                    value={length}
                    onChange={(e) => setLength(parseFloat(e.target.value) || 0)}
                    min={1}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Width</span>
                  <input
                    type="number"
                    value={width}
                    onChange={(e) => setWidth(parseFloat(e.target.value) || 0)}
                    min={1}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block mb-1">Height</span>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(parseFloat(e.target.value) || 0)}
                    min={1}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Packed Weight (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={weightKg}
                  onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
                  min={0.01}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Fragility Class</label>
                <select
                  value={fragility}
                  onChange={(e) => setFragility(e.target.value as FragilityClass)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value={FragilityClass.LOW}>Low (Sturdy / Rigid items)</option>
                  <option value={FragilityClass.MEDIUM}>Medium (Standard appliances)</option>
                  <option value={FragilityClass.HIGH}>High (Glass, sensitive components)</option>
                  <option value={FragilityClass.VERY_HIGH}>Very High (Precision instruments)</option>
                </select>
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow"
              >
                Next: Current Packaging →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Baseline Packaging */}
        {step === 2 && (
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-200">Current Packaging (Baseline)</h3>
                <p className="text-xs text-slate-400">Used to calculate exact material and cost savings.</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-300">
                <input
                  type="checkbox"
                  checked={includeBaseline}
                  onChange={(e) => setIncludeBaseline(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                Include Baseline
              </label>
            </div>

            {includeBaseline ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Outer Length (mm)</label>
                    <input
                      type="number"
                      value={baseOuterL}
                      onChange={(e) => setBaseOuterL(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Outer Width (mm)</label>
                    <input
                      type="number"
                      value={baseOuterW}
                      onChange={(e) => setBaseOuterW(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Outer Height (mm)</label>
                    <input
                      type="number"
                      value={baseOuterH}
                      onChange={(e) => setBaseOuterH(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Board Thickness (mm)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={baseBoardTh}
                      onChange={(e) => setBaseBoardTh(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Board Specification</label>
                    <input
                      type="text"
                      value={baseBoardType}
                      onChange={(e) => setBaseBoardType(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Unit Cost</label>
                    <input
                      type="number"
                      step="0.1"
                      value={baseUnitCost}
                      onChange={(e) => setBaseUnitCost(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Currency</label>
                    <input
                      type="text"
                      value={baseCurrency}
                      onChange={(e) => setBaseCurrency(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white uppercase"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-500 bg-slate-950/40 rounded-xl">
                Baseline skipped. Packaging will be optimized from product dimensions, and savings
                will show as <span className="font-semibold text-slate-400">NOT CONFIGURED</span>.
              </div>
            )}

            <div className="pt-4 flex justify-between">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow"
              >
                Next: Clearances →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Clearances & Engine Config */}
        {step === 3 && (
          <div className="bg-slate-900/60 p-6 rounded-xl border border-slate-800 space-y-5 shadow-xl">
            <h3 className="text-sm font-bold text-slate-200">Clearances & Packaging Rules</h3>
            <p className="text-xs text-slate-400">
              Deterministic rules applied to generate candidate packaging alternatives.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">Alt 1: Tight Fit</span>
                <span className="text-[11px] text-slate-500 block">Material-optimized</span>
                <label className="text-xs text-slate-400 block pt-1">Clearance (mm)</label>
                <input
                  type="number"
                  value={minClearance}
                  onChange={(e) => setMinClearance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="bg-blue-950/30 p-4 rounded-xl border border-blue-500/30 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-300">Alt 2: Standard</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">
                    RECOMMENDED
                  </span>
                </div>
                <span className="text-[11px] text-slate-400 block">Balanced drop clearance</span>
                <label className="text-xs text-slate-400 block pt-1">Clearance (mm)</label>
                <input
                  type="number"
                  value={stdClearance}
                  onChange={(e) => setStdClearance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-200 block">Alt 3: Protective</span>
                <span className="text-[11px] text-slate-500 block">Perimeter foam cushioning</span>
                <label className="text-xs text-slate-400 block pt-1">Clearance + Cushion (mm)</label>
                <input
                  type="number"
                  value={generousClearance}
                  onChange={(e) => setGenerousClearance(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Assumed Board Thickness (mm)</label>
                <input
                  type="number"
                  step="0.5"
                  value={boardThickness}
                  onChange={(e) => setBoardThickness(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Cushion Foam Thickness (mm)</label>
                <input
                  type="number"
                  value={insertThickness}
                  onChange={(e) => setInsertThickness(parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="pt-4 flex justify-between items-center">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2"
              >
                {submitting ? (
                  <span>Generating 3D Models & Standards...</span>
                ) : (
                  <>
                    <span>🚀</span>
                    <span>Generate & Optimize Packaging</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}
