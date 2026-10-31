import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { createProject, fetchProduct, uploadModel } from '../api/projects'
import type {
  FragilityClass,
  ProductInput,
  BaselinePackaging,
  OptimizationConfig,
  FetchProductResult,
  UploadFileResult,
  ComponentInput,
} from '../types'

// ── Start mode ────────────────────────────────────────────────

type StartMode = 'select' | 'manual' | 'fetch' | 'upload'

// ── Sub-components ────────────────────────────────────────────

const Label: React.FC<{ children: React.ReactNode; note?: string; required?: boolean }> = ({
  children, note, required,
}) => (
  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
    {note && <span className="text-slate-400 font-normal ml-1.5">({note})</span>}
  </label>
)

const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label: string; note?: string; required?: boolean }> = ({
  label, note, required, ...props
}) => (
  <div>
    <Label note={note} required={required}>{label}</Label>
    <input
      {...props}
      className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
    />
  </div>
)

const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; note?: string; required?: boolean }> = ({
  label, note, required, children, ...props
}) => (
  <div>
    <Label note={note} required={required}>{label}</Label>
    <select
      {...props}
      className="w-full px-3 py-2 text-sm rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
    >
      {children}
    </select>
  </div>
)

// ── Fetch flow ────────────────────────────────────────────────

const FetchFlow: React.FC<{
  onFetched: (result: FetchProductResult) => void
  onSkip: () => void
}> = ({ onFetched, onSkip }) => {
  const [modelNumber, setModelNumber] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FetchProductResult | null>(null)

  const handleFetch = async () => {
    if (!modelNumber.trim() && !url.trim()) {
      setError('Enter a model number or URL.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetchProduct({
        model_number: modelNumber.trim() || null,
        product_url: url.trim() || null,
      })
      setResult(res)
      if (res.success) onFetched(res)
    } catch (err: any) {
      setError(err.message ?? 'Fetch failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
          Fetch from El Araby
        </h2>
        <p className="text-xs text-slate-500">
          Enter a model number (e.g. <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">TSF-16W</code>,{' '}
          <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">BL500/2</code>) or a product page URL.
          Supported offline: TSF-16W and BL500/2.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          label="Model number"
          note="e.g. TSF-16W"
          value={modelNumber}
          onChange={(e) => setModelNumber(e.target.value)}
          placeholder="TSF-16W"
        />
        <Input
          label="Product page URL"
          note="optional"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.elarabygroup.com/…"
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && !result.success && result.error && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          {result.error}
        </div>
      )}

      {result?.success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded px-3 py-2 space-y-2">
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Fetched {result.fields.length} field(s) — continuing to form below.
          </p>
          {result.warning && (
            <p className="text-xs text-amber-600 dark:text-amber-400">{result.warning}</p>
          )}
          {result.unresolved_fields.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Not available — must be entered manually:
              </p>
              <ul className="text-[11px] text-slate-500 space-y-0.5">
                {result.unresolved_fields.map((f) => (
                  <li key={f} className="flex items-start gap-1">
                    <span className="text-amber-500 shrink-0">•</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold disabled:opacity-50 transition-colors"
        >
          {loading ? 'Fetching…' : 'Fetch product data'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Skip — enter manually
        </button>
      </div>
    </div>
  )
}

// ── Upload flow ───────────────────────────────────────────────

const UploadFlow: React.FC<{
  onUploaded: (result: UploadFileResult) => void
  onSkip: () => void
}> = ({ onUploaded, onSkip }) => {
  const fileRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<UploadFileResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    setLoading(true)
    setError(null)
    try {
      const res = await uploadModel(file)
      setResult(res)
      if (res.success) onUploaded(res)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 mb-1">
          Upload 3D / CAD File
        </h2>
        <p className="text-xs text-slate-500 leading-relaxed">
          Supported formats: STL, OBJ, GLB/GLTF (via trimesh), DXF (via ezdxf), STEP (if CadQuery installed).
          <br />
          <span className="text-amber-600 dark:text-amber-400 font-semibold">DWG is not supported</span> by free libraries — export to DXF or STEP from your CAD tool.
        </p>
      </div>

      <div
        className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 dark:hover:border-blue-600 transition-colors"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
      >
        <svg className="w-8 h-8 mx-auto mb-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        <p className="text-sm text-slate-500">{loading ? 'Parsing file…' : 'Click or drag file here'}</p>
        <p className="text-[11px] text-slate-400 mt-1">STL · OBJ · GLB · STEP · DXF — max 50 MB</p>
        <input
          ref={fileRef}
          type="file"
          accept=".stl,.obj,.glb,.gltf,.step,.stp,.dxf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className={`rounded px-3 py-2 border text-xs space-y-1 ${result.success
          ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
          {result.success ? (
            <>
              <p className="font-semibold text-emerald-700 dark:text-emerald-400">
                Parsed {result.components.length} component(s) from {result.file_name}
              </p>
              {result.warning && <p className="text-amber-600 dark:text-amber-400">{result.warning}</p>}
              <p className="text-slate-500">Units assumed: {result.units_assumed ?? 'mm'}. Confirm before running optimization.</p>
            </>
          ) : (
            <p className="text-red-700 dark:text-red-400">{result.error}</p>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onSkip}
          className="px-4 py-2 rounded-md border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Skip — enter manually
        </button>
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────

const FRAGILITY_OPTIONS: { value: FragilityClass; label: string; desc: string }[] = [
  { value: 'LOW' as FragilityClass, label: 'Low', desc: 'Robust, non-fragile items' },
  { value: 'MEDIUM' as FragilityClass, label: 'Medium', desc: 'Standard appliances' },
  { value: 'HIGH' as FragilityClass, label: 'High', desc: 'Electronics, glass, sensitive parts' },
  { value: 'VERY_HIGH' as FragilityClass, label: 'Very High', desc: 'Precision instruments, displays' },
]

const MainForm: React.FC<{
  prefillComponents?: ComponentInput[]
  prefillProductName?: string
  prefillWeight?: number | null
}> = ({ prefillComponents, prefillProductName, prefillWeight }) => {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Product
  const [name, setName] = useState(prefillProductName ?? '')
  const [model, setModel] = useState('')
  const [brand, setBrand] = useState('')
  const [weightKg, setWeightKg] = useState<string>(prefillWeight ? String(prefillWeight) : '')
  const [fragility, setFragility] = useState<FragilityClass | ''>('')

  // Dimensions (manual)
  const [hasDims, setHasDims] = useState(false)
  const [dimL, setDimL] = useState('')
  const [dimW, setDimW] = useState('')
  const [dimH, setDimH] = useState('')
  const [dimUnit, setDimUnit] = useState<'mm' | 'cm' | 'inch'>('mm')

  // Baseline
  const [includeBaseline, setIncludeBaseline] = useState(false)
  const [baseL, setBaseL] = useState('')
  const [baseW, setBaseW] = useState('')
  const [baseH, setBaseH] = useState('')
  const [baseBoardTh, setBaseBoardTh] = useState('')
  const [baseBoardType, setBaseBoardType] = useState('')
  const [baseUnitCost, setBaseUnitCost] = useState('')
  const [baseCurrency, setBaseCurrency] = useState('EGP')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      setError('Project name is required.')
      return
    }
    if (!fragility) {
      setError('Fragility class is required — please select one.')
      return
    }

    const product: ProductInput = {
      name: name.trim(),
      model: model.trim() || undefined,
      brand: brand.trim() || undefined,
      weight_kg: weightKg ? parseFloat(weightKg) : undefined,
      fragility_class: fragility as FragilityClass,
      packed_dimensions: hasDims && dimL && dimW && dimH
        ? { length: parseFloat(dimL), width: parseFloat(dimW), height: parseFloat(dimH), unit: dimUnit }
        : undefined,
      components: prefillComponents ?? [],
      provenance: { source_name: 'User entered', source_type: 'USER_ENTERED' as any, is_edited: false },
    }

    const baseline: BaselinePackaging | undefined = includeBaseline && baseL && baseW && baseH
      ? {
          carton_outer_length_mm: parseFloat(baseL),
          carton_outer_width_mm: parseFloat(baseW),
          carton_outer_height_mm: parseFloat(baseH),
          board_thickness_mm: baseBoardTh ? parseFloat(baseBoardTh) : undefined,
          board_type: baseBoardType.trim() || undefined,
          carton_cost_per_unit: baseUnitCost ? parseFloat(baseUnitCost) : undefined,
          currency: baseCurrency.trim() || undefined,
          data_label: 'USER ENTERED',
          provenance: { source_name: 'User entered', source_type: 'USER_ENTERED' as any, is_edited: false },
        }
      : undefined

    const config: OptimizationConfig = {
      min_clearance_mm: 15,
      standard_clearance_mm: 25,
      generous_clearance_mm: 40,
      board_thickness_mm: 4,
      insert_thickness_mm: 25,
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await createProject({
        name: `${name.trim()} – Optimization`,
        product,
        components: prefillComponents ?? [],
        baseline,
        optimization_config: config,
        language: 'en',
      })
      navigate(`/projects/${res.project_id}`)
    } catch (err: any) {
      setError(err.response?.data?.detail ?? err.message ?? 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Product info */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
          Product Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3">
            <Input
              label="Project / product name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tornado Stand Fan TSF-16W packaging"
            />
          </div>
          <Input
            label="Model number"
            note="optional"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="TSF-16W"
          />
          <Input
            label="Brand"
            note="optional"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="Tornado"
          />
          <Input
            label="Net weight"
            note="kg"
            type="number"
            min={0}
            step={0.01}
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            placeholder="Not available — enter if known"
          />
        </div>

        {/* Fragility — required */}
        <div>
          <Label required>Fragility class</Label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {FRAGILITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setFragility(opt.value)}
                className={`p-2.5 rounded-lg border text-left text-xs transition-all ${
                  fragility === opt.value
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-400'
                }`}
              >
                <div className="font-semibold">{opt.label}</div>
                <div className="text-[10px] mt-0.5 text-slate-400">{opt.desc}</div>
              </button>
            ))}
          </div>
          {!fragility && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
              Fragility class is required. It affects the clearance applied in optimization.
            </p>
          )}
        </div>
      </section>

      {/* Dimensions */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
          Product Dimensions
          <span className="ms-2 text-[11px] font-normal text-slate-400">
            (Leave blank if unknown — add component dimensions later)
          </span>
        </h3>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={hasDims}
            onChange={(e) => setHasDims(e.target.checked)}
            className="rounded border-slate-300"
          />
          I know the assembled product dimensions
        </label>

        {hasDims && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input
              label="Length"
              type="number"
              min={1}
              value={dimL}
              onChange={(e) => setDimL(e.target.value)}
              placeholder="e.g. 460"
            />
            <Input
              label="Width"
              type="number"
              min={1}
              value={dimW}
              onChange={(e) => setDimW(e.target.value)}
              placeholder="e.g. 400"
            />
            <Input
              label="Height"
              type="number"
              min={1}
              value={dimH}
              onChange={(e) => setDimH(e.target.value)}
              placeholder="e.g. 1400"
            />
            <Select
              label="Unit"
              value={dimUnit}
              onChange={(e) => setDimUnit(e.target.value as any)}
            >
              <option value="mm">mm</option>
              <option value="cm">cm</option>
              <option value="inch">inch</option>
            </Select>
          </div>
        )}

        {prefillComponents && prefillComponents.length > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
            {prefillComponents.length} component(s) pre-filled from uploaded file.
            Confirm units before running optimization.
          </div>
        )}
      </section>

      {/* Baseline packaging */}
      <section className="space-y-4">
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700 pb-2">
          Current Packaging (Baseline)
          <span className="ms-2 text-[11px] font-normal text-slate-400">
            Required to compute material and cost savings
          </span>
        </h3>

        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
          <input
            type="checkbox"
            checked={includeBaseline}
            onChange={(e) => setIncludeBaseline(e.target.checked)}
            className="rounded border-slate-300"
          />
          I know the current carton dimensions
        </label>

        {includeBaseline && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Outer length (mm)"
              note="USER ENTERED"
              type="number"
              min={1}
              value={baseL}
              onChange={(e) => setBaseL(e.target.value)}
              placeholder="e.g. 575 for TSF-16W"
            />
            <Input
              label="Outer width (mm)"
              type="number"
              min={1}
              value={baseW}
              onChange={(e) => setBaseW(e.target.value)}
              placeholder="e.g. 310"
            />
            <Input
              label="Outer height (mm)"
              type="number"
              min={1}
              value={baseH}
              onChange={(e) => setBaseH(e.target.value)}
              placeholder="e.g. 490"
            />
            <Input
              label="Board thickness (mm)"
              note="optional — unknown = leave blank"
              type="number"
              min={0}
              step={0.1}
              value={baseBoardTh}
              onChange={(e) => setBaseBoardTh(e.target.value)}
              placeholder="Not available — enter if measured"
            />
            <Input
              label="Board type"
              note="optional"
              value={baseBoardType}
              onChange={(e) => setBaseBoardType(e.target.value)}
              placeholder="e.g. Single wall corrugated"
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                label="Carton cost/unit"
                note="optional"
                type="number"
                min={0}
                step={0.01}
                value={baseUnitCost}
                onChange={(e) => setBaseUnitCost(e.target.value)}
                placeholder="0.00"
              />
              <Input
                label="Currency"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                placeholder="EGP"
              />
            </div>
          </div>
        )}
      </section>

      {/* Clearance notice */}
      <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 text-[11px] text-slate-500 dark:text-slate-400">
        <strong className="text-slate-600 dark:text-slate-300">Clearances:</strong> The optimizer uses
        engineering assumptions (min 15 mm / standard 25 mm / generous 40 mm).
        These are user-editable engineering assumptions, not ISO-specified values.
        You can adjust them inside the project after creation.
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded px-3 py-2 text-xs text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Creating…' : 'Create Project'}
        </button>
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-5 py-2.5 rounded-md border border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ── Page ──────────────────────────────────────────────────────

export const NewProject: React.FC = () => {
  const [searchParams] = useSearchParams()
  const startParam = searchParams.get('start') as StartMode | null

  const [mode, setMode] = useState<StartMode>(startParam ?? 'select')
  const [prefillComponents, setPrefillComponents] = useState<ComponentInput[] | undefined>()
  const [prefillProductName, setPrefillProductName] = useState<string | undefined>()
  const [prefillWeight, setPrefillWeight] = useState<number | null | undefined>()

  useEffect(() => {
    if (startParam && ['manual', 'fetch', 'upload'].includes(startParam)) {
      setMode(startParam as StartMode)
    }
  }, [startParam])

  const handleFetched = (result: any) => {
    // Extract name and weight from fetched fields to pre-fill the form
    const nameField = result.fields?.find((f: any) => f.field_name === 'product_name')
    const weightField = result.fields?.find((f: any) => f.field_name === 'net_weight_kg')
    if (nameField) setPrefillProductName(String(nameField.value))
    if (weightField) setPrefillWeight(Number(weightField.value))
    setMode('manual')
  }

  const handleUploaded = (result: any) => {
    if (result.components?.length > 0) {
      setPrefillComponents(result.components)
    }
    const name = result.file_name?.replace(/\.[^.]+$/, '') ?? ''
    if (name) setPrefillProductName(name)
    setMode('manual')
  }

  const MODES = [
    { id: 'manual' as StartMode, label: 'Enter manually', desc: 'Blank form — enter all values yourself' },
    { id: 'fetch' as StartMode, label: 'Fetch from El Araby', desc: 'Auto-fetch known product data by model number' },
    { id: 'upload' as StartMode, label: 'Upload 3D / CAD', desc: 'Upload STL, OBJ, GLB, STEP, or DXF' },
  ]

  return (
    <div className="max-w-3xl space-y-8 pb-16">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">New Project</h1>
        <p className="text-sm text-slate-500 mt-1">
          Start from real product data. No values are pre-filled — enter only what you know.
        </p>
      </div>

      {/* Mode selector */}
      {mode === 'select' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className="text-left p-4 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-blue-400 dark:hover:border-blue-600 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{m.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Back link if in a sub-mode */}
      {mode !== 'select' && (
        <button
          type="button"
          onClick={() => setMode('select')}
          className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to start options
        </button>
      )}

      {/* Flows */}
      {mode === 'fetch' && (
        <FetchFlow onFetched={handleFetched} onSkip={() => setMode('manual')} />
      )}

      {mode === 'upload' && (
        <UploadFlow onUploaded={handleUploaded} onSkip={() => setMode('manual')} />
      )}

      {mode === 'manual' && (
        <MainForm
          prefillComponents={prefillComponents}
          prefillProductName={prefillProductName}
          prefillWeight={prefillWeight}
        />
      )}
    </div>
  )
}
