import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  createProject,
  fetchProduct,
  uploadModel,
  getBrands,
  extractFromDescription,
  getCandidateSpecs,
  estimateDimensions,
} from '../api/projects'
import type { ProjectDraft } from '../api/projects'
import { formatApiErrorDetail } from '../api/error-format'
import { parseProjectCreate } from '../api/project-contract'
import {
  FragilityClass,
  SourceType,
  PRODUCT_TYPES,
  type ProductType,
  type ProductSearchResponse,
  type ProductCandidate,
  type CandidateSpecsResponse,
  type ComponentSpec,
  type SourceEvidence,
  type UploadFileResult,
  type Provenance,
} from '../types'

// ── Provenance Badge Component ────────────────────────────────
export const ProvenanceBadge: React.FC<{
  sourceType?: string
  confidence?: number
  isEdited?: boolean
  onClick?: () => void
}> = ({ sourceType, confidence, isEdited, onClick }) => {
  const getBadge = () => {
    switch (sourceType) {
      case SourceType.FROM_DESCRIPTION:
        return {
          label: 'From your description',
          bg: 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
        }
      case SourceType.EL_ARABY_DATASHEET:
      case SourceType.EL_ARABY_WEBSITE:
        return {
          label: 'Fetched (Verified El Araby)',
          bg: 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
        }
      case SourceType.CAD_EXTRACTED:
        return {
          label: 'CAD-Extracted',
          bg: 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800',
        }
      case SourceType.AI_ESTIMATED:
        return {
          label: `AI-Estimated (${Math.round((confidence || 0.45) * 100)}% - Low)`,
          bg: 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-700',
        }
      case SourceType.PUBLIC_RETAIL:
        return {
          label: 'Public Retail (1 source)',
          bg: 'bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
        }
      default:
        return {
          label: isEdited ? 'User Edited' : 'User Entered',
          bg: 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border-stone-200 dark:border-stone-700',
        }
    }
  }

  const badge = getBadge()

  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${badge.bg} ${
        onClick ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
      }`}
      title={onClick ? 'Click to inspect verification source evidence' : undefined}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      <span>{badge.label}</span>
      {onClick && <span className="text-[9px] opacity-60">ℹ</span>}
    </span>
  )
}

function round1(val: number): number {
  return Math.round(val * 10) / 10
}

const fetchedFieldLabels: Record<string, string> = {
  brand: 'Brand', model: 'Model number', productType: 'Product type', weightKg: 'Net weight', fragility: 'Fragility class',
  productL: 'Product length', productW: 'Product width', productH: 'Product height', baseL: 'Carton length',
  baseW: 'Carton width', baseH: 'Carton height', boardType: 'Board type', boardThickness: 'Board thickness', unitCost: 'Unit cost',
}

function getSourceHost(sourceUrl: string): string {
  try { return new URL(sourceUrl).hostname || 'Source page' } catch { return 'Source page' }
}

export const NewProject: React.FC = () => {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Input flow modes: 'describe' | 'fetch' | 'upload'
  const [inputMode, setInputMode] = useState<'describe' | 'fetch' | 'upload'>('describe')

  // Available brands from backend
  const [brandList, setBrandList] = useState<string[]>([])

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchProductName, setSearchProductName] = useState('')
  const [searchModel, setSearchModel] = useState('')
  const [searchBrand, setSearchBrand] = useState('')
  const [customBrand, setCustomBrand] = useState('')
  const [searchCategory, setSearchCategory] = useState('')
  const [searchUrl, setSearchUrl] = useState('')
  const [searchCountry, setSearchCountry] = useState('EG')
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchResponse, setSearchResponse] = useState<ProductSearchResponse | null>(null)
  const [selectedCandidate, setSelectedCandidate] = useState<ProductCandidate | null>(null)
  const [selectedCandidateApplied, setSelectedCandidateApplied] = useState(false)
  const [searchSubmitted, setSearchSubmitted] = useState(false)
  const [fetchFieldSources, setFetchFieldSources] = useState<Record<string, string>>({})

  // Upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<UploadFileResult | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Describe state
  const [descriptionText, setDescriptionText] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [draft, setDraft] = useState<ProjectDraft | null>(null)

  // Highlight freshly populated fields
  const [recentlyFilled, setRecentlyFilled] = useState<Record<string, boolean>>({})

  // Form submission & validation states
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null)

  // ── Project Form Fields (NO HIDDEN DEFAULT VALUES) ───────────
  const [projectName, setProjectName] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [productType, setProductType] = useState<ProductType | ''>('')
  const [productTypeProvenance, setProductTypeProvenance] = useState<Provenance>({ source_name: 'User entered', source_type: SourceType.USER_ENTERED })
  const [sku, setSku] = useState('')
  const [weightKg, setWeightKg] = useState<number | ''>('')
  const [fragility, setFragility] = useState<FragilityClass | ''>('')
  const [productL, setProductL] = useState<number | ''>('')
  const [productW, setProductW] = useState<number | ''>('')
  const [productH, setProductH] = useState<number | ''>('')
  const [unit, setUnit] = useState<'mm' | 'cm' | 'inch'>('mm')
  const [productProvenance, setProductProvenance] = useState<Provenance>({
    source_name: 'User Manual Entry',
    source_type: SourceType.USER_ENTERED,
  })

  // Baseline carton fields (NO HIDDEN DEFAULT VALUES)
  const [baseL, setBaseL] = useState<number | ''>('')
  const [baseW, setBaseW] = useState<number | ''>('')
  const [baseH, setBaseH] = useState<number | ''>('')
  const [boardType, setBoardType] = useState('')
  const [boardThickness, setBoardThickness] = useState<number | ''>('')
  const [unitCost, setUnitCost] = useState<number | ''>('')
  const [currency, setCurrency] = useState('EGP')
  const [unitsPerPallet, setUnitsPerPallet] = useState<number | ''>('')
  useEffect(() => {
    setValidationErrors({})
  }, [projectName, brand, model, productType, weightKg, fragility, productL, productW, productH, baseL, baseW, baseH, boardType, boardThickness, unitCost, unitsPerPallet])
  const [palletType, setPalletType] = useState('Euro Pallet (1200 x 800 mm)')
  const [baselineProvenance, setBaselineProvenance] = useState<Provenance>({
    source_name: 'User Manual Entry',
    source_type: SourceType.USER_ENTERED,
  })

  // Candidate Specs, Evidence & Components
  const [candidateSpecs, setCandidateSpecs] = useState<CandidateSpecsResponse | null>(null)
  const [componentsList, setComponentsList] = useState<ComponentSpec[]>([])
  const [hasUserEdits, setHasUserEdits] = useState(false)
  const [hasUnconfirmedEstimate, setHasUnconfirmedEstimate] = useState(false)
  const [aiEstimateComparison, setAiEstimateComparison] = useState<string[]>([])
  const [showEvidenceDrawer, setShowEvidenceDrawer] = useState(false)
  const [activeEvidenceField, setActiveEvidenceField] = useState<string | null>(null)

  // Ignored suggestions
  const [ignoredSuggestions, setIgnoredSuggestions] = useState<Record<string, boolean>>({})

  // Clearances
  const [minClearance, setMinClearance] = useState(15.0)
  const [stdClearance, setStdClearance] = useState(25.0)
  const [genClearance, setGenClearance] = useState(40.0)

  useEffect(() => {
    getBrands()
      .then((b) => setBrandList(b))
      .catch(() => setBrandList(['Tornado', 'Toshiba', 'Sharp', 'El Araby Group']))

    const start = searchParams.get('start')
    if (start === 'upload') setInputMode('upload')
    else if (start === 'fetch') setInputMode('fetch')
    else setInputMode('describe')
  }, [searchParams])

  const flashFields = (fieldNames: string[]) => {
    const map: Record<string, boolean> = {}
    fieldNames.forEach((fn) => { map[fn] = true })
    setRecentlyFilled(map)
    setTimeout(() => setRecentlyFilled({}), 3500)
  }

  // ── Handle Description Extraction ───────────────────────────
  const handleExtractDescription = async () => {
    if (!descriptionText.trim()) {
      setExtractError('Please enter a description first.')
      return
    }
    try {
      setExtracting(true)
      setExtractError(null)
      setDraft(null)

      const result = await extractFromDescription(descriptionText.trim())
      const descriptionWords = descriptionText.trim().split(/\s+/).filter(Boolean)
      const ambiguousDescription = descriptionWords.length <= 3 && !result.brand && !result.model_number && !result.product_length_mm && !result.product_height_mm
      if (ambiguousDescription) {
        setInputMode('fetch')
        setSearchProductName(descriptionText.trim())
        setSearchModel('')
        setSearchError(null)
        setSearchSubmitted(true)
        setSearching(true)
        try {
          const matches = await fetchProduct({ product_name: descriptionText.trim() })
          setSearchResponse(matches)
          setDraft(null)
        } catch (err: any) {
          setSearchResponse(null)
          setSearchError(formatApiErrorDetail(err?.response?.data?.detail ?? err?.message).summary || 'Product search failed. Retry or enter specifications manually.')
        } finally {
          setSearching(false)
        }
        return
      }
      setDraft(result)

      const filled: string[] = []
      if (result.name) { setProjectName(result.name); filled.push('name') }
      if (result.brand) { setBrand(result.brand); filled.push('brand') }
      if (result.model_number) { setModel(result.model_number); filled.push('model') }
      if (result.product_type && PRODUCT_TYPES.includes(result.product_type as ProductType)) {
        setProductType(result.product_type as ProductType)
        const typeField = result.fields.find((field) => field.field === 'product_type')
        const sourceType = typeField?.provenance === 'AI_ESTIMATED' ? SourceType.AI_ESTIMATED : SourceType.FROM_DESCRIPTION
        setProductTypeProvenance({ source_name: sourceType === SourceType.AI_ESTIMATED ? 'AI classification from description' : 'From your description', source_type: sourceType })
      }
      if (result.sku) { setSku(result.sku); filled.push('sku') }
      if (result.net_weight_kg) { setWeightKg(result.net_weight_kg); filled.push('weight') }
      if (result.product_length_mm) { setProductL(result.product_length_mm); filled.push('productL') }
      if (result.product_width_mm) { setProductW(result.product_width_mm); filled.push('productW') }
      if (result.product_height_mm) { setProductH(result.product_height_mm); filled.push('productH') }
      if (result.carton_length_mm) { setBaseL(result.carton_length_mm); filled.push('baseL') }
      if (result.carton_width_mm) { setBaseW(result.carton_width_mm); filled.push('baseW') }
      if (result.carton_height_mm) { setBaseH(result.carton_height_mm); filled.push('baseH') }
      if (result.board_type) { setBoardType(result.board_type); filled.push('boardType') }
      if (result.fragility) { setFragility(result.fragility as any); filled.push('fragility') }

      if ([result.net_weight_kg, result.product_length_mm, result.product_width_mm, result.product_height_mm].some((value) => value != null)) {
        setProductProvenance({ source_name: 'From your description', source_type: SourceType.FROM_DESCRIPTION })
      }
      if ([result.carton_length_mm, result.carton_width_mm, result.carton_height_mm, result.board_type].some((value) => value != null)) {
        setBaselineProvenance({ source_name: 'From your description', source_type: SourceType.FROM_DESCRIPTION })
      }

      flashFields(filled)
    } catch (err: any) {
      setExtractError(err?.response?.data?.detail || err?.message || 'Extraction failed. Please enter details manually below.')
    } finally {
      setExtracting(false)
    }
  }

  // ── Handle Web Fetch ─────────────────────────────────────────
  const handleExecuteFetch = async (queryToUse?: string) => {
    const q = (queryToUse || searchQuery).trim()
    const productName = queryToUse ? '' : searchProductName.trim()
    const modelNumber = queryToUse ? queryToUse.trim() : searchModel.trim()
    if (!q && !productName && !modelNumber && !searchUrl.trim()) {
      setSearchError('Enter a product name to search. A model number is optional.')
      return
    }

    try {
      setSearching(true)
      setSearchError(null)
      setSearchSubmitted(true)
      setSearchResponse(null)
      setSelectedCandidate(null)
      setSelectedCandidateApplied(false)

      const finalBrand = searchBrand === 'Other…' ? customBrand.trim() : searchBrand

      const res = await fetchProduct({
        query: q || undefined,
        product_name: productName || undefined,
        model_number: modelNumber || undefined,
        brand: finalBrand || undefined,
        category: searchCategory || undefined,
        product_url: searchUrl.trim() || undefined,
        country_code: searchCountry,
      })

      setSearchResponse(res)
    } catch (err: any) {
      setSearchResponse(null)
      setSearchError(formatApiErrorDetail(err?.response?.data?.detail ?? err?.message).summary || 'Product lookup failed. Retry or enter specifications manually.')
    } finally {
      setSearching(false)
    }
  }

  const handleSelectCandidate = async (cand: ProductCandidate) => {
    if (hasUserEdits) {
      const confirmReplace = window.confirm(
        `Replace your entered specifications with the sourced product page for ${cand.name}?`
      )
      if (!confirmReplace) return
    }

    setSelectedCandidate(cand)
    setSelectedCandidateApplied(true)
    setHasUserEdits(false)
    setHasUnconfirmedEstimate(false)
    const filled: string[] = []
    const source = cand.provenance.source_name || cand.source_url
    const fromSource = `From web fetch: ${source}`
    const fieldSources: Record<string, string> = {}
    const provided = (key: string, value: unknown) => { fieldSources[key] = value !== null && value !== undefined && value !== '' ? fromSource : 'Not listed — enter this value' }

    setProjectName(`${cand.brand || cand.name} ${cand.model || ''} Packaging`.trim())
    filled.push('name')
    setBrand(cand.brand || '')
    provided('brand', cand.brand)
    filled.push('brand')
    setModel(cand.model || '')
    provided('model', cand.model)
    filled.push('model')
    const typeFromSource = PRODUCT_TYPES.find((type) => type === (cand.category || '').toLowerCase().replace(/\s+/g, '_'))
    setProductType(typeFromSource || '')
    provided('productType', typeFromSource)
    setProductTypeProvenance(typeFromSource ? { source_name: fromSource, source_url: cand.source_url, retrieval_date: cand.provenance.retrieval_date, source_type: cand.source_type } : { source_name: 'Not provided by selected source — enter it', source_type: SourceType.USER_ENTERED })

    setSku(cand.sku || '')
    if (cand.sku) filled.push('sku')
    const listedFragility = String(cand.spec_fields?.fragility_class?.value ?? cand.specs_table?.['Fragility Class'] ?? '').toUpperCase()
    const sourcedFragility = (['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const).find((value) => value === listedFragility) || ''
    const listedBoard = cand.specs_table?.['Board Type'] || cand.specs_table?.board_type || ''
    const listedThickness = cand.spec_fields?.board_thickness_mm?.value ?? cand.specs_table?.['Board Thickness (mm)'] ?? cand.specs_table?.board_thickness_mm
    const listedCost = cand.spec_fields?.carton_cost_per_unit?.value ?? cand.specs_table?.['Unit Cost'] ?? cand.specs_table?.carton_cost_per_unit
    const parseProvidedNumber = (value: unknown): number | '' => {
      if (typeof value === 'number' && Number.isFinite(value)) return value
      if (typeof value === 'string') {
        const match = value.trim().match(/^\d+(?:\.\d+)?$/)
        if (match) return Number(match[0])
      }
      return ''
    }

    setWeightKg(cand.net_weight_kg ?? '')
    provided('weightKg', cand.net_weight_kg)
    if (cand.net_weight_kg != null) filled.push('weight')
    setFragility(sourcedFragility as FragilityClass | '')
    provided('fragility', sourcedFragility)

    setProductL(cand.dimensions_mm?.length ?? '')
    setProductW(cand.dimensions_mm?.width ?? '')
    setProductH(cand.dimensions_mm?.height ?? '')
    if (cand.dimensions_mm) { setUnit('mm'); filled.push('productL', 'productW', 'productH') }
    for (const key of ['productL', 'productW', 'productH']) provided(key, cand.dimensions_mm?.[key === 'productL' ? 'length' : key === 'productW' ? 'width' : 'height'])

    if (cand.carton_dimensions_mm) {
      setBaseL(cand.carton_dimensions_mm.length)
      setBaseW(cand.carton_dimensions_mm.width)
      setBaseH(cand.carton_dimensions_mm.height)
      setBaselineProvenance(cand.provenance)
      filled.push('baseL', 'baseW', 'baseH')
    }
    setBaseL(cand.carton_dimensions_mm?.length ?? '')
    setBaseW(cand.carton_dimensions_mm?.width ?? '')
    setBaseH(cand.carton_dimensions_mm?.height ?? '')
    for (const key of ['baseL', 'baseW', 'baseH']) provided(key, cand.carton_dimensions_mm?.[key === 'baseL' ? 'length' : key === 'baseW' ? 'width' : 'height'])
    setBoardType(listedBoard)
    setBoardThickness(parseProvidedNumber(listedThickness))
    setUnitCost(parseProvidedNumber(listedCost))
    provided('boardType', listedBoard)
    provided('boardThickness', parseProvidedNumber(listedThickness))
    provided('unitCost', parseProvidedNumber(listedCost))

    setProductProvenance(cand.provenance)
    setFetchFieldSources(fieldSources)
    flashFields(filled)

    // Load multi-source specs, components, and evidence
    try {
      const specsRes = await getCandidateSpecs(cand.candidate_id, cand.model || '')
      setCandidateSpecs(specsRes)
      if (specsRes.components && specsRes.components.length > 0) {
        setComponentsList(specsRes.components)
      }
    } catch {
      if (cand.components && cand.components.length > 0) {
        setComponentsList(cand.components)
      }
    }
  }

  // ── Handle Explicit AI Dimension Estimation (Last Resort) ──────
  const handleEstimateDimensions = async () => {
    try {
      const q = model || searchQuery || projectName || 'Appliance'
      const res = await estimateDimensions(q, searchCategory)
      setProductL(res.product_dimensions_mm.length)
      setProductW(res.product_dimensions_mm.width)
      setProductH(res.product_dimensions_mm.height)
      setBaseL(res.carton_dimensions_mm.length)
      setBaseW(res.carton_dimensions_mm.width)
      setBaseH(res.carton_dimensions_mm.height)
      setWeightKg(res.net_weight_kg)
      setUnit('mm')

      setProductProvenance({
        source_name: `AI-Estimated (${(res.comparison_products || []).join(', ')})`,
        source_type: SourceType.AI_ESTIMATED,
        confidence: res.confidence,
      })
      setBaselineProvenance({
        source_name: `AI-Estimated (${(res.comparison_products || []).join(', ')})`,
        source_type: SourceType.AI_ESTIMATED,
        confidence: res.confidence,
      })

      setHasUnconfirmedEstimate(true)
      setAiEstimateComparison(res.comparison_products || [])
      flashFields(['productL', 'productW', 'productH', 'baseL', 'baseW', 'baseH', 'weight'])
    } catch {
      setSearchError('AI estimation unavailable. Please enter dimensions manually.')
    }
  }

  // ── Handle CAD Upload ────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    try {
      setUploading(true)
      setUploadError(null)
      const res = await uploadModel(file)
      setUploadResult(res)

      if (!res.success) {
        setUploadError(res.error || 'Failed to parse CAD file.')
        return
      }

      const filled: string[] = []
      if (res.bounding_box_mm) {
        setProductL(round1(res.bounding_box_mm.length_mm))
        setProductW(round1(res.bounding_box_mm.width_mm))
        setProductH(round1(res.bounding_box_mm.height_mm))
        setUnit('mm')
        filled.push('productL', 'productW', 'productH')
      }

      setProductProvenance({
        source_name: `CAD Upload (${file.name})`,
        source_type: SourceType.CAD_EXTRACTED,
      })

      flashFields(filled)
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || err?.message || 'Error uploading file.')
    } finally {
      setUploading(false)
    }
  }

  // ── Unit Switching with Numeric Conversion ────────────────────
  const handleUnitChange = (newUnit: 'mm' | 'cm' | 'inch') => {
    if (newUnit === unit) return
    const factorToMm = unit === 'mm' ? 1.0 : unit === 'cm' ? 10.0 : 25.4
    const factorFromMm = newUnit === 'mm' ? 1.0 : newUnit === 'cm' ? 0.1 : 1.0 / 25.4

    if (typeof productL === 'number') setProductL(round1(productL * factorToMm * factorFromMm))
    if (typeof productW === 'number') setProductW(round1(productW * factorToMm * factorFromMm))
    if (typeof productH === 'number') setProductH(round1(productH * factorToMm * factorFromMm))
    setUnit(newUnit)
  }

  // ── Gap Filling: Proposed Suggestions for Missing Fields ──────
  const pL_mm = typeof productL === 'number' ? (unit === 'cm' ? productL * 10 : unit === 'inch' ? productL * 25.4 : productL) : 0
  const pW_mm = typeof productW === 'number' ? (unit === 'cm' ? productW * 10 : unit === 'inch' ? productW * 25.4 : productW) : 0
  const pH_mm = typeof productH === 'number' ? (unit === 'cm' ? productH * 10 : unit === 'inch' ? productH * 25.4 : productH) : 0

  const hasCartonDims = typeof baseL === 'number' && typeof baseW === 'number' && typeof baseH === 'number' && baseL > 0 && baseW > 0 && baseH > 0

  const suggestions: Record<string, { value: any; reason: string; label: string; formula?: string }> = {}

  // 1. Proposed Carton Dimensions (derived from Product Dimensions + Clearance)
  if (pL_mm > 0 && baseL === '' && !ignoredSuggestions['baseL']) {
    suggestions['baseL'] = {
      value: Math.ceil((pL_mm + 40) / 5) * 5,
      reason: 'Calculated: Product L + 40 mm engineering clearance buffer',
      formula: 'Product L + 40 mm buffer allowance',
      label: 'Carton Length',
    }
  }
  if (pW_mm > 0 && baseW === '' && !ignoredSuggestions['baseW']) {
    suggestions['baseW'] = {
      value: Math.ceil((pW_mm + 40) / 5) * 5,
      reason: 'Calculated: Product W + 40 mm engineering clearance buffer',
      formula: 'Product W + 40 mm buffer allowance',
      label: 'Carton Width',
    }
  }
  if (pH_mm > 0 && baseH === '' && !ignoredSuggestions['baseH']) {
    suggestions['baseH'] = {
      value: Math.ceil((pH_mm + 40) / 5) * 5,
      reason: 'Calculated: Product H + 40 mm engineering clearance buffer',
      formula: 'Product H + 40 mm buffer allowance',
      label: 'Carton Height',
    }
  }

  // 2. Unit Cost: ONLY suggest when carton dimensions exist (zero invented numbers)
  if (hasCartonDims && unitCost === '' && !ignoredSuggestions['unitCost']) {
    const area_m2 = (2 * (Number(baseL) + Number(baseW)) * Number(baseH) + 2 * (Number(baseL) * Number(baseW))) / 1000000.0
    const calcCost = Math.round(area_m2 * 18.5 * 10) / 10
    suggestions['unitCost'] = {
      value: calcCost,
      reason: `Calculated from blank area (${area_m2.toFixed(2)} m²) @ 18.50 EGP/m² board rate`,
      formula: 'FEFCO 0201 Blank Area (m²) × Sheet Rate (18.50 EGP/m²)',
      label: 'Unit Cost',
    }
  }

  // 3. Units Per Pallet: ONLY suggest when carton dimensions exist (zero invented numbers)
  if (hasCartonDims && unitsPerPallet === '' && !ignoredSuggestions['unitsPerPallet']) {
    const perLayer = Math.max(1, Math.floor(1200 / Number(baseL)) * Math.floor(800 / Number(baseW)))
    const layers = Math.max(1, Math.min(6, Math.floor(1600 / Number(baseH))))
    const calcUnits = perLayer * layers
    suggestions['unitsPerPallet'] = {
      value: calcUnits,
      reason: `Calculated Euro Pallet layout: ${perLayer} per layer × ${layers} layers (${calcUnits} units)`,
      formula: 'Euro Pallet (1200×800 mm) grid pattern up to 1600 mm max stack',
      label: 'Units Per Pallet',
    }
  }

  const handleAcceptSuggestion = (field: string) => {
    const sug = suggestions[field]
    if (!sug) return
    if (field === 'baseL') setBaseL(sug.value)
    else if (field === 'baseW') setBaseW(sug.value)
    else if (field === 'baseH') setBaseH(sug.value)
    else if (field === 'unitCost') setUnitCost(sug.value)
    else if (field === 'unitsPerPallet') setUnitsPerPallet(sug.value)
    flashFields([field])
  }

  const handleAcceptAllSuggestions = () => {
    const filled: string[] = []
    Object.keys(suggestions).forEach((f) => {
      handleAcceptSuggestion(f)
      filled.push(f)
    })
    flashFields(filled)
  }

  // ── Field Count & Progress Tracking ───────────────────────────
  const numberOrUndefined = (value: number | ''): number | undefined => value === '' ? undefined : Number(value)
  const factor = unit === 'mm' ? 1 : unit === 'cm' ? 10 : 25.4
  const mappedComponents = componentsList.map((component) => ({
    name: component.name,
    length_mm: component.length_mm,
    width_mm: component.width_mm,
    height_mm: component.height_mm,
    weight_kg: component.weight_kg,
    quantity: component.quantity || 1,
    fragility: component.fragile ? FragilityClass.HIGH : undefined,
    notes: component.notes || undefined,
  }))
  const projectPayload: unknown = {
    name: projectName.trim(),
    description: descriptionText.trim() || undefined,
    product: {
    name: projectName.trim(), brand: brand.trim(), model: model.trim() || undefined, sku: sku.trim() || undefined,
      category: searchCategory || selectedCandidate?.category || undefined, product_type: productType,
      product_type_provenance: { ...productTypeProvenance, is_edited: false },
      weight_kg: numberOrUndefined(weightKg), fragility_class: fragility,
      packed_dimensions: { length: numberOrUndefined(productL) === undefined ? undefined : Number(productL) * factor, width: numberOrUndefined(productW) === undefined ? undefined : Number(productW) * factor, height: numberOrUndefined(productH) === undefined ? undefined : Number(productH) * factor, unit: 'mm' },
      components: mappedComponents,
      image_url: selectedCandidate?.image_url || candidateSpecs?.images?.[0] || undefined,
      images: candidateSpecs?.images || selectedCandidate?.images || [], provenance: { ...productProvenance, is_edited: false },
    },
    components: mappedComponents,
    baseline: {
      carton_outer_length_mm: numberOrUndefined(baseL), carton_outer_width_mm: numberOrUndefined(baseW), carton_outer_height_mm: numberOrUndefined(baseH),
      board_type: boardType, board_thickness_mm: numberOrUndefined(boardThickness), carton_cost_per_unit: numberOrUndefined(unitCost), currency,
      units_per_pallet: numberOrUndefined(unitsPerPallet), pallet_type: palletType, provenance: { ...baselineProvenance, is_edited: false },
    },
    optimization_config: { min_clearance_mm: minClearance, standard_clearance_mm: stdClearance, generous_clearance_mm: genClearance },
    language: i18n.language.startsWith('ar') ? 'ar' : 'en',
  }
  const parsedProject = parseProjectCreate(projectPayload)
  const formFieldNames = [
    ['Project Name', 'name'], ['Brand', 'product.brand'], ['Product Type', 'product.product_type'],
    ['Net Weight', 'product.weight_kg'], ['Fragility class', 'product.fragility_class'], ['Product Length', 'product.packed_dimensions.length'],
    ['Product Width', 'product.packed_dimensions.width'], ['Product Height', 'product.packed_dimensions.height'], ['Carton Length', 'baseline.carton_outer_length_mm'],
    ['Carton Width', 'baseline.carton_outer_width_mm'], ['Carton Height', 'baseline.carton_outer_height_mm'], ['Board Type', 'baseline.board_type'],
    ['Board Thickness', 'baseline.board_thickness_mm'], ['Unit Cost', 'baseline.carton_cost_per_unit'], ['Units Per Pallet', 'baseline.units_per_pallet'],
    ['SKU / Barcode', 'product.sku'],
  ] as const
  const pathToField: Record<string, string> = {
    name: 'projectName', 'product.brand': 'brand', 'product.model': 'model', 'product.product_type': 'productType', 'product.weight_kg': 'weightKg',
    'product.product_type_provenance.source_type': 'productType', 'product.provenance.source_type': 'productL', 'baseline.provenance.source_type': 'baseL',
    'product.fragility_class': 'fragility', 'product.packed_dimensions.length': 'productL', 'product.packed_dimensions.width': 'productW',
    'product.packed_dimensions.height': 'productH', 'baseline.carton_outer_length_mm': 'baseL', 'baseline.carton_outer_width_mm': 'baseW',
    'baseline.carton_outer_height_mm': 'baseH', 'baseline.board_type': 'boardType', 'baseline.board_thickness_mm': 'boardThickness',
    'baseline.carton_cost_per_unit': 'unitCost', 'baseline.units_per_pallet': 'unitsPerPallet', 'product.sku': 'sku',
  }
  const activeValidationErrors = parsedProject.success ? {} : parsedProject.error.issues.reduce<Record<string, string>>((errors, issue) => {
    const key = pathToField[issue.path.join('.')]
    if (key) errors[key] ||= key === 'fragility'
      ? t('newProject.validation.fragilityRequired', 'Select a fragility class.')
      : key === 'productType'
        ? t('newProject.validation.productTypeRequired', 'Select a product type.')
        : issue.code === 'invalid_type' && issue.input === undefined
          ? t('newProject.validation.requiredField', 'Enter a value for this required field.')
          : (i18n.language.startsWith('ar') ? t('newProject.validation.serverInvalid') : issue.message)
    return errors
  }, {})
  useEffect(() => {
    try {
      sessionStorage.setItem('nxtpak:assistant-page-context', JSON.stringify({
        route: '/projects/new', page_title: 'New Project', active_view: 'Specifications form',
        fields: [
          ['Project name', projectName, null, 'entered'], ['Brand', brand, null, 'entered'], ['Model', model, null, 'entered'],
          ['Product type', productType, null, productTypeProvenance.source_type], ['Weight', weightKg, 'kg', productProvenance.source_type],
          ['Fragility class', fragility, null, 'entered'], ['Product length', productL, unit, productProvenance.source_type],
          ['Product width', productW, unit, productProvenance.source_type], ['Product height', productH, unit, productProvenance.source_type],
          ['Carton length', baseL, 'mm', baselineProvenance.source_type], ['Carton width', baseW, 'mm', baselineProvenance.source_type],
          ['Carton height', baseH, 'mm', baselineProvenance.source_type], ['Board type', boardType, null, baselineProvenance.source_type],
          ['Board thickness', boardThickness, 'mm', baselineProvenance.source_type], ['Unit cost', unitCost, currency, baselineProvenance.source_type],
          ['Units per pallet', unitsPerPallet, null, baselineProvenance.source_type],
        ].map(([label, value, fieldUnit, provenance]) => ({ label, value, unit: fieldUnit, provenance, status: value === '' || value == null ? 'missing' : 'provided' })),
        missing_fields: invalidFieldLabels,
        validation_errors: activeValidationErrors,
        selected_candidate: selectedCandidate ? { name: selectedCandidate.name, model: selectedCandidate.model, source_url: selectedCandidate.source_url } : null,
        search_query: [searchProductName, searchModel].filter(Boolean).join(' '),
        visible_errors: [formError, searchError, extractError].filter(Boolean),
      }))
    } catch { /* The assistant can still receive route-only context if storage is unavailable. */ }
  }, [projectName, brand, model, productType, productTypeProvenance, weightKg, fragility, productL, productW, productH, unit, productProvenance, baseL, baseW, baseH, boardType, boardThickness, unitCost, currency, unitsPerPallet, baselineProvenance, activeValidationErrors, selectedCandidate, searchProductName, searchModel, formError, searchError, extractError])
  const shownValidationErrors = { ...activeValidationErrors, ...validationErrors }
  const validationIssues = parsedProject.success ? [] : parsedProject.error.issues
  const invalidFields = new Set(validationIssues.map((issue) => pathToField[issue.path.join('.')]).filter(Boolean))
  const requiredFormFields = formFieldNames.filter(([, path]) => !['product.sku', 'baseline.units_per_pallet'].includes(path))
  const totalFields = requiredFormFields.length
  const filledFieldsCount = requiredFormFields.filter(([, path]) => !invalidFields.has(pathToField[path] || '')).length
  const missingRequired = requiredFormFields.filter(([, path]) => invalidFields.has(pathToField[path] || '')).map(([label]) => label)
  const invalidFieldLabels = formFieldNames.filter(([, path]) => invalidFields.has(pathToField[path] || '')).map(([label]) => label)
  const isFormComplete = parsedProject.success
  const searchDiagnostics = searchResponse?.diagnostics ?? []
  const searchProviderFailed = !!searchResponse && searchResponse.candidates.length === 0 && !searchDiagnostics.some((source) => source.status === 'success') && searchDiagnostics.some((source) => source.status === 'error')

  // ── Handle Create Project ─────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setValidationErrors({})
    if (!parsedProject.success) {
      const errors: Record<string, string> = {}
      for (const issue of parsedProject.error.issues) {
        const key = pathToField[issue.path.join('.')] || (issue.path[0] === 'baseline' ? 'baseL' : 'projectName')
        errors[key] ||= i18n.language.startsWith('ar') ? t('newProject.validation.serverInvalid') : issue.message
      }
      setValidationErrors(errors)
      setFormError(`${t('newProject.validation.summary')}\n${Object.entries(errors).map(([key, message]) => `${t(`newProject.validation.fields.${key}`)}: ${message}`).join('\n')}`)
      const firstField = Object.keys(errors)[0]
      requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-validation-field="${firstField}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return
    }

    // Dimension check
    const normL = Number(productL) * factor
    const normW = Number(productW) * factor
    const normH = Number(productH) * factor
    const bL = Number(baseL)
    const bW = Number(baseW)
    const bH = Number(baseH)

    // Dimension check: if product is shipped assembled, carton must envelope it.
    // If components are listed, product is knocked down (KD) and packed as parts,
    // so verify that each individual component fits inside the carton.
    if (componentsList.length > 0) {
      const bDiag = Math.sqrt(bL * bL + bW * bW + bH * bH)
      const bMin = Math.min(bL, bW, bH)
      const bVol = bL * bW * bH

      const oversizedComp = componentsList.find((c) => {
        const cMax = Math.max(c.length_mm, c.width_mm, c.height_mm)
        const cMin = Math.min(c.length_mm, c.width_mm, c.height_mm)
        const cVol = c.length_mm * c.width_mm * c.height_mm
        return cMax > bDiag || cMin > bMin || cVol > bVol
      })

      if (oversizedComp) {
        setFormError(
          `Component '${oversizedComp.name}' (${oversizedComp.length_mm} × ${oversizedComp.width_mm} × ${oversizedComp.height_mm} mm) cannot physically fit inside the baseline carton (${bL} × ${bW} × ${bH} mm).`
        )
        return
      }
    } else if (bL < normL || bW < normW || bH < normH) {
      // Check other orientations before rejecting
      const pSorted = [normL, normW, normH].sort((a, b) => a - b)
      const bSorted = [bL, bW, bH].sort((a, b) => a - b)
      if (pSorted[0] > bSorted[0] || pSorted[1] > bSorted[1] || pSorted[2] > bSorted[2]) {
        setFormError(
          `Baseline carton (${bL} × ${bW} × ${bH} mm) is smaller than the product (${Math.round(normL)} × ${Math.round(normW)} × ${Math.round(normH)} mm). ` +
          'Please verify dimensions or provide disassembled component parts.'
        )
        return
      }
    }

    try {
      setSubmitting(true)
      const res = await createProject(parsedProject.data)

      if (res.duplicate_warning) {
        setDuplicateNotice(res.duplicate_message || 'A packaging project for this model already exists.')
      }

      navigate(`/projects/${res.project_id}?tab=recommendation`)
    } catch (err: any) {
      const detail = err?.response?.data?.detail
      const formatted = formatApiErrorDetail(detail ?? err?.message)
      const errors: Record<string, string> = {}
      for (const issue of formatted.issues) {
        const path = issue.loc.filter((part) => part !== 'body').join('.')
        const key = pathToField[path]
        if (key) errors[key] ||= i18n.language.startsWith('ar') ? t('newProject.validation.serverInvalid') : issue.message
      }
      if (Object.keys(errors).length) {
        setValidationErrors(errors)
        requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-validation-field="${Object.keys(errors)[0]}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      }
      const detailLines = Object.entries(errors).map(([key, message]) => `${t(`newProject.validation.fields.${key}`)}: ${message}`)
      setFormError([t('newProject.validation.summary'), ...detailLines, ...(detailLines.length ? [] : [formatted.summary])].join('\n'))
    } finally {
      setSubmitting(false)
    }
  }

  const highlightClass = (key: string) =>
    recentlyFilled[key]
      ? 'ring-2 ring-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/30 transition-all duration-700'
      : ''

  return (
    <div className="max-w-5xl mx-auto py-6 px-4 sm:px-6 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900 dark:text-stone-100 tracking-tight">
          {t('newProject.title', 'Create Packaging Optimization Project')}
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          {t('newProject.subtitle', 'Provide real product dimensions and current baseline carton specifications to compute material, strength, and pallet savings.')}
        </p>
      </div>

      {duplicateNotice && (
        <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 text-xs text-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">Notice: Existing Product Found</p>
          <p>{duplicateNotice}</p>
        </div>
      )}

      {/* ── STEP 1: DESCRIBE OR SEARCH ───────────────────────────────── */}
      <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
              Step 1: Input Product Details
            </h2>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              Choose your preferred method. All extracted values populate the review form below.
            </p>
          </div>

          {/* Flow mode selector */}
          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg text-xs font-medium">
            <button
              type="button"
              onClick={() => setInputMode('describe')}
              className={`px-3 py-1 rounded-md transition-colors ${
                inputMode === 'describe'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Free-Text Description
            </button>
            <button
              type="button"
              onClick={() => setInputMode('fetch')}
              className={`px-3 py-1 rounded-md transition-colors ${
                inputMode === 'fetch'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              Live Web Fetch
            </button>
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className={`px-3 py-1 rounded-md transition-colors ${
                inputMode === 'upload'
                  ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 shadow-sm font-semibold'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
            >
              3D / CAD Upload
            </button>
          </div>
        </div>

        {/* Mode A: Free-Text Description */}
        {inputMode === 'describe' && (
          <div className="space-y-3">
            <textarea
              value={descriptionText}
              onChange={(e) => setDescriptionText(e.target.value)}
              rows={3}
              placeholder={t('newProject.descriptionPlaceholder', 'Describe only specifications you know, including units and provenance.')}
              className="w-full text-xs p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50/50 dark:bg-stone-950/50 text-stone-900 dark:text-stone-100 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-stone-500 font-sans leading-relaxed"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleExtractDescription}
                disabled={extracting || !descriptionText.trim()}
                className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors disabled:opacity-40 flex items-center gap-2"
              >
                {extracting ? 'Analysing specifications…' : 'Analyse & Extract Specs'}
              </button>
              <span className="text-[10px] text-stone-400">
                Populates form below with "From your description" provenance
              </span>
            </div>

            {extractError && (
              <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {extractError}
              </div>
            )}
          </div>
        )}

        {/* Mode B: Live Web Fetch */}
        {inputMode === 'fetch' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Product name
                </label>
                <input
                  type="text"
                  value={searchProductName}
                  onChange={(e) => { setSearchProductName(e.target.value); setSearchSubmitted(false); setSearchResponse(null); setSelectedCandidate(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleExecuteFetch() } }}
                  placeholder="Enter a product name"
                  className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Model number / SKU
                </label>
                <input
                  type="text"
                  value={searchModel}
                  onChange={(e) => { setSearchModel(e.target.value); setSearchSubmitted(false); setSearchResponse(null); setSelectedCandidate(null) }}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleExecuteFetch() } }}
                  placeholder="Optional model number or SKU"
                  className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                  Brand Filter
                </label>
                <select
                  value={searchBrand}
                  onChange={(e) => { setSearchBrand(e.target.value); setSearchSubmitted(false); setSearchResponse(null); setSelectedCandidate(null) }}
                  className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
                >
                  <option value="">All Brands</option>
                  {brandList.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => handleExecuteFetch()}
                disabled={searching || (!searchProductName.trim() && !searchModel.trim() && !searchQuery.trim() && !searchUrl.trim())}
                className="px-4 py-2 rounded-md bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold shadow transition-colors disabled:opacity-40"
              >
                {searching ? 'Searching web…' : 'Fetch Specifications'}
              </button>
            </div>

            {searchError && (
              <div className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                {searchError}
                <button type="button" onClick={() => void handleExecuteFetch()} disabled={searching} className="ms-3 font-semibold underline disabled:opacity-50">Retry</button>
              </div>
            )}

            {searching && (
              <section aria-label="Loading product results" aria-live="polite" className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {[0, 1, 2].map((item) => <div key={item} className="animate-pulse space-y-3 rounded-lg border border-stone-200 bg-white p-3.5 dark:border-stone-700 dark:bg-stone-800"><div className="h-24 rounded-md bg-stone-200 dark:bg-stone-700" /><div className="h-3 w-2/3 rounded bg-stone-200 dark:bg-stone-700" /><div className="h-3 w-1/2 rounded bg-stone-100 dark:bg-stone-700/70" /></div>)}
              </section>
            )}

            {searchResponse && (
              <div className="text-xs text-stone-600 dark:text-stone-400" role="status">
                {searchProviderFailed
                  ? <p role="alert">Web search is temporarily unavailable. Please retry.</p>
                  : searchSubmitted && searchResponse.candidates.length === 0
                    ? <p>No products found, try another name.</p>
                    : <p>Select a matching product to review its sourced details.</p>}
                {searchResponse.candidates.length === 0 && (
                  <button type="button" disabled={searching} className="mt-2 me-3 font-semibold underline disabled:opacity-50" onClick={() => void handleExecuteFetch()}>Retry search</button>
                )}
                {searchResponse.candidates.length === 0 && !searchProviderFailed && (
                  <button type="button" className="mt-2 text-blue-700 dark:text-blue-400 underline" onClick={() => {
                    const field = document.querySelector<HTMLElement>('[data-validation-field="projectName"]')
                    field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    field?.focus()
                  }}>Create manually</button>
                )}
              </div>
            )}

            {/* Typo Correction Prompt */}
            {searchResponse?.did_you_mean && (
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex items-center justify-between">
                <span>Did you mean <strong>{searchResponse.did_you_mean}</strong>?</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(searchResponse.did_you_mean!)
                    handleExecuteFetch(searchResponse.did_you_mean!)
                  }}
                  className="px-2.5 py-1 rounded bg-amber-700 text-white font-medium text-[11px]"
                >
                  Search for {searchResponse.did_you_mean}
                </button>
              </div>
            )}

            {/* Candidate Cards */}
            {searchResponse && searchResponse.candidates.length > 0 && (
              <div className="space-y-2 pt-2">
                  <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
                  Search results ({searchResponse.candidates.length})
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {searchResponse.candidates.map((cand) => (
                    <article key={cand.candidate_id} className={`rounded-lg border bg-white p-3.5 transition-colors dark:bg-stone-800 ${
                        cand.candidate_id === selectedCandidate?.candidate_id
                          ? 'border-stone-500 ring-2 ring-stone-500/20'
                          : 'border-stone-200 dark:border-stone-700'
                      }`}
                    >
                      <button type="button" aria-pressed={cand.candidate_id === selectedCandidate?.candidate_id} aria-label={`Select candidate ${cand.name}`} onClick={() => { setSelectedCandidate(cand); setSelectedCandidateApplied(false) }} className="w-full space-y-2 rounded-md text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-500">
                        {cand.image_url && <img src={cand.image_url} alt={cand.name} loading="lazy" className="h-28 w-full rounded-md bg-stone-100 object-contain dark:bg-stone-900" />}
                        <div className="flex items-center justify-between gap-2"><span className="font-bold text-xs text-stone-900 dark:text-stone-100">{cand.name}</span><ProvenanceBadge sourceType={cand.source_type} /></div>
                        <p className="text-[11px] text-stone-500">{cand.brand || 'Brand not listed'}{cand.model ? ` · ${cand.model}` : ''}</p>
                        <div className="text-[10px] font-mono text-stone-500 dark:text-stone-400 flex flex-wrap gap-x-3 gap-y-1">
                          {cand.dimensions_mm && <span>Product: {cand.dimensions_mm.length}×{cand.dimensions_mm.width}×{cand.dimensions_mm.height} mm</span>}
                          {cand.carton_dimensions_mm && <span>Carton: {cand.carton_dimensions_mm.length}×{cand.carton_dimensions_mm.width}×{cand.carton_dimensions_mm.height} mm</span>}
                          {cand.net_weight_kg != null && <span>Weight: {cand.net_weight_kg} kg</span>}
                        </div>
                      </button>
                      <div className="mt-2 flex items-center justify-between gap-2 border-t border-stone-100 pt-2 dark:border-stone-700">{cand.source_url ? <a href={cand.source_url} target="_blank" rel="noreferrer" className="truncate text-[10px] text-stone-600 underline dark:text-stone-400">{getSourceHost(cand.source_url)}</a> : <span className="text-[10px] text-stone-500">Source unavailable</span>}<span className="text-[10px] text-stone-500">{cand.dimensions_mm || cand.net_weight_kg != null ? 'Specifications available' : 'Details not listed'}</span></div>
                    </article>
                  ))}
                </div>
                {selectedCandidate && searchResponse.candidates.some((candidate) => candidate.candidate_id === selectedCandidate.candidate_id) && <div className="flex justify-end"><button type="button" disabled={selectedCandidateApplied} onClick={() => void handleSelectCandidate(selectedCandidate)} className="rounded-md bg-stone-800 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-stone-700 disabled:cursor-default disabled:opacity-60 dark:bg-stone-200 dark:text-stone-900 dark:hover:bg-stone-100">{selectedCandidateApplied ? 'Product details applied' : 'Use this product'}</button></div>}
              </div>
            )}
          </div>
        )}

        {/* Mode C: CAD / 3D Upload */}
        {inputMode === 'upload' && (
          <div className="space-y-3">
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-lg p-6 text-center cursor-pointer hover:border-stone-500 transition-colors bg-stone-50/50 dark:bg-stone-950/30"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".stl,.obj,.3mf,.glb,.step,.stp,.dxf,.pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleFileUpload(file)
                }}
              />
              <p className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                Click to browse 3D CAD or drawing file
              </p>
              <p className="text-[10px] text-stone-400 mt-1">
                Supports STL, OBJ, STEP, GLB, 3MF, DXF (max 50 MB). Extracts bounding box geometry automatically.
              </p>
            </div>

            {uploading && <p className="text-xs text-stone-500 text-center">Parsing 3D CAD mesh…</p>}
            {uploadError && <div className="p-3 rounded bg-rose-50 text-xs text-rose-700 border border-rose-200">{uploadError}</div>}
            {uploadResult?.success && (
              <div className="p-3 rounded bg-emerald-50 dark:bg-emerald-950/40 text-xs text-emerald-800 border border-emerald-200">
                ✓ Extracted CAD Bounding Box: {uploadResult.bounding_box_mm?.length_mm} × {uploadResult.bounding_box_mm?.width_mm} × {uploadResult.bounding_box_mm?.height_mm} mm
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP 2: SUMMARY & GAP FILLING ────────────────────────────── */}
      <div className="bg-stone-100 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900 font-bold text-xs flex items-center justify-center shadow-sm">
            {filledFieldsCount}/{totalFields}
          </div>
          <div>
            <div className="text-xs font-bold text-stone-800 dark:text-stone-200">
              {`${filledFieldsCount} of ${totalFields} specification fields completed`}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px] text-stone-500">
              {candidateSpecs?.sources_checked ? (
                candidateSpecs.sources_checked.map((s, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 bg-white dark:bg-stone-800 px-1.5 py-0.5 rounded border border-stone-200 dark:border-stone-700 font-mono"
                  >
                    <span className="text-emerald-500">✓</span>
                    <span>{s.source}</span>
                  </span>
                ))
              ) : (
                <p>
                  {isFormComplete
                    ? 'All mandatory packaging engineering inputs ready.'
                    : `Needs correction: ${invalidFieldLabels.length ? invalidFieldLabels.join(', ') : missingRequired.join(', ')}.`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {candidateSpecs && (
            <button
              type="button"
              onClick={() => {
                setActiveEvidenceField('product_dimensions')
                setShowEvidenceDrawer(true)
              }}
              className="text-xs px-3 py-1.5 rounded-md bg-stone-200 hover:bg-stone-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-200 font-medium transition-colors"
            >
              Inspect Sources (Evidence Drawer)
            </button>
          )}

          {Object.keys(suggestions).length > 0 && (
            <button
              type="button"
              onClick={handleAcceptAllSuggestions}
              className="text-xs px-3 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white font-medium shadow-sm transition-colors"
            >
              Accept Sourced Suggestions ({Object.keys(suggestions).length})
            </button>
          )}
        </div>
      </div>

      {/* Honest Missing Dimensions Banner if unlisted */}
      {selectedCandidate && selectedCandidate.packed_dimensions_available === false && (
        <div className="p-4 rounded-xl bg-stone-100 dark:bg-stone-900 border border-amber-300 dark:border-amber-700/80 space-y-2">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-semibold text-xs">
            <span>⚠</span>
            <span>No public source lists the packed dimensions of {selectedCandidate.model}.</span>
          </div>
          <p className="text-[11px] text-stone-600 dark:text-stone-400">
            Choose how to proceed without inventing data:
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('carton-dims-section')
                el?.scrollIntoView({ behavior: 'smooth' })
              }}
              className="px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-[11px] font-medium"
            >
              (a) Measure & Enter Manually
            </button>
            <button
              type="button"
              onClick={() => setInputMode('upload')}
              className="px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-[11px] font-medium"
            >
              (b) Upload CAD / Carton Label Photo
            </button>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('search-url-input')
                el?.focus()
              }}
              className="px-2.5 py-1 rounded bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-[11px] font-medium"
            >
              (c) Paste Datasheet URL
            </button>
            <button
              type="button"
              onClick={handleEstimateDimensions}
              className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-medium"
            >
              (d) Estimate with AI (Low Confidence)
            </button>
          </div>
        </div>
      )}

      {/* Amber Warning Banner for Unconfirmed AI Estimates */}
      {hasUnconfirmedEstimate && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500 text-amber-900 dark:text-amber-200 text-xs flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
          <div className="space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <span>⚠️ AI-Estimated Dimensions (Low Confidence)</span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300">
              Values estimated from similar models ({aiEstimateComparison.join(', ')}). You must confirm these values or replace with measured numbers before generating final packaging alternatives.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setHasUnconfirmedEstimate(false)}
            className="px-3.5 py-1.5 rounded-md bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap shadow-sm transition-colors"
          >
            Confirm Estimated Values
          </button>
        </div>
      )}

      {/* Suggestions Banner if any gaps */}
      {Object.keys(suggestions).length > 0 && (
        <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
          <span className="font-bold text-amber-900 dark:text-amber-200 block text-[11px]">
            AI & Engineering Suggestions for Incomplete Fields:
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(suggestions).map(([fKey, sug]) => (
              <div
                key={fKey}
                className="p-2.5 rounded bg-white dark:bg-stone-900 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between gap-2"
              >
                <div>
                  <span className="font-semibold text-stone-800 dark:text-stone-200">{sug.label}: </span>
                  <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">{String(sug.value)}</span>
                  <p className="text-[10px] text-stone-400">{sug.reason}</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAcceptSuggestion(fKey)}
                    className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-medium"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => setIgnoredSuggestions((prev) => ({ ...prev, [fKey]: true }))}
                    className="px-1.5 py-0.5 text-stone-400 hover:text-stone-600 text-[10px]"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP 3: REVIEW SPECIFICATIONS FORM ───────────────────────── */}
      <form noValidate onSubmit={handleSubmit} className="space-y-6">
        {formError && (
          <div role="alert" aria-live="assertive" className="p-3 rounded-md bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {formError.includes('\n') ? (
              <ul className="space-y-1 list-disc list-inside">
                {formError.split('\n').map((line, i) => <li key={i}>{line}</li>)}
              </ul>
            ) : formError}
          </div>
        )}

        {/* Section 1: Product Specifications */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                1. Product Specifications
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Values represent physical product envelope and mass.
              </p>
            </div>
            <ProvenanceBadge
              sourceType={productProvenance.source_type}
              onClick={candidateSpecs ? () => { setActiveEvidenceField('product_dimensions'); setShowEvidenceDrawer(true) } : undefined}
            />
          </div>

          {selectedCandidate && Object.keys(fetchFieldSources).length > 0 && (
            <div className="rounded-md border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-950/50 p-3" aria-label="Fetched field provenance">
              <p className="text-[10px] font-semibold text-stone-600 dark:text-stone-300 mb-2">Details from selected product</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                {Object.entries(fetchFieldSources).map(([field, sourceText]) => (
                  <p key={field} className={`text-[10px] ${sourceText.startsWith('From web fetch:') ? 'text-stone-600 dark:text-stone-400' : 'text-amber-700 dark:text-amber-400'}`}>
                    <span className="font-medium">{fetchedFieldLabels[field] || field}:</span> {sourceText}
                  </p>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Project Name */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="projectName"
                aria-invalid={!!shownValidationErrors.projectName}
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Tornado Stand Fan TSF-16W"
                className={`w-full text-xs px-3 py-2 rounded-md border ${
                  shownValidationErrors['projectName']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('name')}`}
              />
              {shownValidationErrors['projectName'] && (
                <p className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors['projectName']}</p>
              )}
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Brand <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="brand"
                aria-invalid={!!shownValidationErrors.brand}
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g. Tornado, Toshiba"
                className={`w-full text-xs px-3 py-2 rounded-md border ${
                  shownValidationErrors['brand']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('brand')}`}
              />
              {shownValidationErrors['brand'] && (
                <p className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors['brand']}</p>
              )}
            </div>

            {/* Model Number */}
            <div>
                <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Model Number <span className="text-stone-400 text-[10px] font-normal">(Optional)</span>
              </label>
              <input
                data-validation-field="model"
                aria-invalid={!!shownValidationErrors.model}
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g. TSF-16W or BL500/2"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['model']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('model')}`}
              />
              {shownValidationErrors['model'] && (
                <p className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors['model']}</p>
              )}
            </div>

            {/* SKU (Optional) */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                SKU / Barcode <span className="text-stone-400 text-[10px] font-normal">(Optional)</span>
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. 6221127018394"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100 ${highlightClass('sku')}`}
              />
            </div>

            {/* Saved parametric product type */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Product Type <span className="text-rose-500">*</span>
              </label>
              <select
                data-validation-field="productType"
                aria-invalid={!!shownValidationErrors.productType}
                data-testid="product-type-select"
                value={productType}
                onChange={(event) => {
                  setProductType(event.target.value as ProductType)
                  setProductTypeProvenance({ source_name: 'User entered', source_type: SourceType.USER_ENTERED })
                }}
                className={`w-full text-xs px-3 py-2 rounded-md border ${shownValidationErrors.productType ? 'border-rose-400 bg-rose-50/20' : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'}`}
              >
                <option value="">-- Select Product Type --</option>
                {PRODUCT_TYPES.map((type) => <option key={type} value={type}>{type.split('_').join(' ')}</option>)}
              </select>
              {fetchFieldSources.productType && <p className={`mt-1 text-[10px] ${fetchFieldSources.productType.startsWith('From web fetch:') ? 'text-stone-500' : 'text-amber-700 dark:text-amber-400'}`}>{fetchFieldSources.productType}</p>}
              {shownValidationErrors.productType && <p className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors.productType}</p>}
            </div>

            {/* Net Weight */}
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Net Weight (kg) <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="weightKg"
                aria-invalid={!!shownValidationErrors.weightKg}
                type="number"
                min="0.01"
                step="0.01"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 7.3"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['weightKg']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('weight')}`}
              />
              {shownValidationErrors['weightKg'] && (
                <p className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors['weightKg']}</p>
              )}
            </div>

            {/* Fragility Class */}
            <div>
              <label className={`block text-xs font-medium mb-1 ${shownValidationErrors.fragility ? 'text-rose-600 dark:text-rose-400' : 'text-stone-700 dark:text-stone-300'}`}>
                Fragility Class <span className={shownValidationErrors.fragility ? 'text-rose-500' : 'text-stone-400'}>*</span>
              </label>
              <select
                data-validation-field="fragility"
                aria-invalid={!!shownValidationErrors.fragility}
                aria-describedby={shownValidationErrors.fragility ? 'fragility-error' : undefined}
                value={fragility}
                onChange={(e) => setFragility(e.target.value as FragilityClass)}
                className={`w-full text-xs px-3 py-2 rounded-md border ${
                  shownValidationErrors['fragility']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('fragility')}`}
              >
                <option value="">-- Select Fragility Class --</option>
                <option value={FragilityClass.LOW}>Low (Sturdy, non-breakable)</option>
                <option value={FragilityClass.MEDIUM}>Medium (Standard consumer appliances)</option>
                <option value={FragilityClass.HIGH}>High (Motors, delicate switches, glass)</option>
                <option value={FragilityClass.VERY_HIGH}>Very High (Precision instrumentation)</option>
              </select>
              {shownValidationErrors['fragility'] && (
                <p id="fragility-error" className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors['fragility']}</p>
              )}
            </div>
          </div>

          {/* Product Dimensions */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                Product Dimensions <span className="text-rose-500">*</span>
              </span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-stone-400 text-[10px]">Unit conversion:</span>
                {(['mm', 'cm', 'inch'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => handleUnitChange(u)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      unit === u
                        ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800'
                        : 'border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-stone-400 mb-0.5">Length ({unit})</label>
                <input
                  data-validation-field="productL"
                  aria-invalid={!!shownValidationErrors.productL}
                  type="number"
                  min="1"
                  step="0.1"
                  value={productL}
                  onChange={(e) => setProductL(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 520"
                  className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                    shownValidationErrors['productL']
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  } ${highlightClass('productL')}`}
                />
              </div>

              <div>
                <label className="block text-[10px] text-stone-400 mb-0.5">Width ({unit})</label>
                <input
                  data-validation-field="productW"
                  aria-invalid={!!shownValidationErrors.productW}
                  type="number"
                  min="1"
                  step="0.1"
                  value={productW}
                  onChange={(e) => setProductW(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 280"
                  className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                    shownValidationErrors['productW']
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  } ${highlightClass('productW')}`}
                />
              </div>

              <div>
                <label className="block text-[10px] text-stone-400 mb-0.5">Height ({unit})</label>
                <input
                  data-validation-field="productH"
                  aria-invalid={!!shownValidationErrors.productH}
                  type="number"
                  min="1"
                  step="0.1"
                  value={productH}
                  onChange={(e) => setProductH(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 450"
                  className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                    shownValidationErrors['productH']
                      ? 'border-rose-400 bg-rose-50/20'
                      : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                  } ${highlightClass('productH')}`}
                />
              </div>
            </div>
          </div>

          {/* Disassembled Components Table — shown only when components are fetched */}
          {componentsList.length > 0 && (
            <div className="pt-3 border-t border-stone-100 dark:border-stone-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200">
                  Disassembled Components ({componentsList.length} parts)
                </span>
                <span className="text-[10px] text-stone-400">
                  Source: product manual / exploded view
                </span>
              </div>
              <div className="overflow-x-auto rounded-lg border border-stone-200 dark:border-stone-700">
                <table className="w-full text-[10px] text-left">
                  <thead>
                    <tr className="bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400">
                      <th className="px-2 py-1.5 font-semibold">Part</th>
                      <th className="px-2 py-1.5 font-semibold text-right">L (mm)</th>
                      <th className="px-2 py-1.5 font-semibold text-right">W (mm)</th>
                      <th className="px-2 py-1.5 font-semibold text-right">H (mm)</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Wt (kg)</th>
                      <th className="px-2 py-1.5 font-semibold text-right">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {componentsList.map((comp, idx) => (
                      <tr
                        key={idx}
                        className={`border-t border-stone-100 dark:border-stone-800 ${
                          idx % 2 === 0
                            ? 'bg-white dark:bg-stone-900'
                            : 'bg-stone-50 dark:bg-stone-900/50'
                        }`}
                      >
                        <td className="px-2 py-1.5 font-medium text-stone-800 dark:text-stone-200">
                          {comp.name}
                          {comp.fragile && (
                            <span className="ml-1 text-amber-500 text-[9px]">⚠ fragile</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-600 dark:text-stone-400">
                          {comp.length_mm}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-600 dark:text-stone-400">
                          {comp.width_mm}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-600 dark:text-stone-400">
                          {comp.height_mm}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-600 dark:text-stone-400">
                          {comp.weight_kg}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-stone-600 dark:text-stone-400">
                          ×{comp.quantity}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Current Baseline Packaging */}
        <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                2. Current Baseline Packaging
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Material and cost savings are evaluated against these baseline specs.
              </p>
            </div>
            <ProvenanceBadge
              sourceType={baselineProvenance.source_type}
              onClick={candidateSpecs ? () => { setActiveEvidenceField('carton_dimensions'); setShowEvidenceDrawer(true) } : undefined}
            />
          </div>

          <div id="carton-dims-section" className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Carton Outer Length (mm) <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="baseL"
                aria-invalid={!!shownValidationErrors.baseL}
                type="number"
                min="1"
                step="0.5"
                value={baseL}
                onChange={(e) => setBaseL(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 575"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['baseL']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('baseL')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Carton Outer Width (mm) <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="baseW"
                aria-invalid={!!shownValidationErrors.baseW}
                type="number"
                min="1"
                step="0.5"
                value={baseW}
                onChange={(e) => setBaseW(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 310"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['baseW']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('baseW')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Carton Outer Height (mm) <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="baseH"
                aria-invalid={!!shownValidationErrors.baseH}
                type="number"
                min="1"
                step="0.5"
                value={baseH}
                onChange={(e) => setBaseH(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 490"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['baseH']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('baseH')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Board Type / Flute <span className="text-rose-500">*</span>
              </label>
              <select
                data-validation-field="boardType"
                aria-invalid={!!shownValidationErrors.boardType}
                value={boardType}
                onChange={(e) => setBoardType(e.target.value)}
                className={`w-full text-xs px-3 py-2 rounded-md border ${
                  shownValidationErrors['boardType']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('boardType')}`}
              >
                <option value="">-- Select Board Flute --</option>
                <option value="B Flute Single Wall">B Flute Single Wall (~3.0 mm)</option>
                <option value="C Flute Single Wall">C Flute Single Wall (~4.0 mm)</option>
                <option value="BC Double Wall">BC Double Wall (~5.0 mm - Standard)</option>
                <option value="E Flute Microflute">E Flute Microflute (~1.5 mm)</option>
                <option value="Heavy Duty Triple Wall">Heavy Duty Triple Wall (~10.0 mm)</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs font-medium mb-1 ${shownValidationErrors.boardThickness ? 'text-rose-600 dark:text-rose-400' : 'text-stone-700 dark:text-stone-300'}`}>
                Board Thickness (mm) <span className={shownValidationErrors.boardThickness ? 'text-rose-500' : 'text-stone-400'}>*</span>
              </label>
              <input
                data-validation-field="boardThickness"
                aria-invalid={!!shownValidationErrors.boardThickness}
                aria-describedby={shownValidationErrors.boardThickness ? 'board-thickness-error' : undefined}
                type="number"
                min="1"
                max="15"
                step="0.1"
                value={boardThickness}
                onChange={(e) => setBoardThickness(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 5.0"
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['boardThickness']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('boardThickness')}`}
              />
              {shownValidationErrors.boardThickness && <p id="board-thickness-error" className="text-[10px] text-rose-500 mt-0.5">{shownValidationErrors.boardThickness}</p>}
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Carton Unit Cost ({currency}) <span className="text-rose-500">*</span>
              </label>
              <input
                data-validation-field="unitCost"
                aria-invalid={!!shownValidationErrors.unitCost}
                type="number"
                min="0.1"
                step="0.1"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={hasCartonDims ? "e.g. 22.5" : "Enter carton dims first"}
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['unitCost']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('unitCost')}`}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Units Per Pallet (optional)
              </label>
              <input
                data-validation-field="unitsPerPallet"
                aria-invalid={!!shownValidationErrors.unitsPerPallet}
                type="number"
                min="1"
                step="1"
                value={unitsPerPallet}
                onChange={(e) => setUnitsPerPallet(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={hasCartonDims ? "e.g. 16" : "Enter carton dims first"}
                className={`w-full text-xs px-3 py-2 rounded-md border font-mono ${
                  shownValidationErrors['unitsPerPallet']
                    ? 'border-rose-400 bg-rose-50/20'
                    : 'border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100'
                } ${highlightClass('unitsPerPallet')}`}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">
                Pallet Type
              </label>
              <select
                value={palletType}
                onChange={(e) => setPalletType(e.target.value)}
                className="w-full text-xs px-3 py-2 rounded-md border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-900 dark:text-stone-100"
              >
                <option value="Euro Pallet (1200 x 800 mm)">Euro Pallet (1200 x 800 mm - Standard)</option>
                <option value="Industrial Pallet (1200 x 1000 mm)">Industrial Pallet (1200 x 1000 mm)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-stone-200 dark:border-stone-800">
          <div className="text-xs text-stone-500">
            {!isFormComplete && (
              <span className="text-rose-600 dark:text-rose-400 font-medium" role="status">
                {invalidFieldLabels.length} {invalidFieldLabels.length === 1 ? 'field still needed:' : 'fields still needed:'}{' '}
                {formFieldNames.filter(([label]) => invalidFieldLabels.includes(label)).map(([label], index) => (
                  <React.Fragment key={label}>
                    {index > 0 ? ', ' : ''}
                    <button type="button" className="underline" onClick={() => {
                      const field = formFieldNames.find(([candidate]) => candidate === label)?.[1]
                      const target = field ? pathToField[field] : undefined
                      const el = target ? document.querySelector<HTMLElement>(`[data-validation-field="${target}"]`) : null
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                      el?.focus()
                    }}>{label}</button>
                  </React.Fragment>
                ))}
              </span>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting || !isFormComplete}
            title={!isFormComplete ? `Missing: ${missingRequired.join(', ')}` : 'Run packaging optimization'}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 dark:bg-stone-200 dark:hover:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold shadow-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? 'Generating Alternatives…' : 'Generate Optimized Packaging Alternatives'}
          </button>
        </div>
      </form>

      {/* ── EVIDENCE DRAWER ──────────────────────────────────────────── */}
      {showEvidenceDrawer && candidateSpecs && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowEvidenceDrawer(false)}
          />
          {/* Slide-over panel */}
          <div className="relative z-10 w-full max-w-md h-full bg-white dark:bg-stone-900 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-200 dark:border-stone-700">
              <div>
                <h2 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                  Source Evidence
                </h2>
                <p className="text-[10px] text-stone-500 mt-0.5">
                  {candidateSpecs.name} — {candidateSpecs.sources_checked.length} source(s) checked
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEvidenceDrawer(false)}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            {/* Tabs: pick spec field */}
            <div className="flex gap-1 px-4 py-2 border-b border-stone-100 dark:border-stone-800 overflow-x-auto">
              {[
                { key: 'product_dimensions', label: 'Product Dims' },
                { key: 'carton_dimensions', label: 'Carton Dims' },
                { key: 'net_weight', label: 'Net Weight' },
                { key: 'gross_weight', label: 'Gross Weight' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveEvidenceField(tab.key)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-colors ${
                    activeEvidenceField === tab.key
                      ? 'bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900'
                      : 'text-stone-500 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {(() => {
                const fieldMap: Record<string, any> = {
                  product_dimensions: candidateSpecs.product_dimensions,
                  carton_dimensions: candidateSpecs.carton_dimensions,
                  net_weight: candidateSpecs.net_weight,
                  gross_weight: candidateSpecs.gross_weight,
                }
                const field = fieldMap[activeEvidenceField || 'product_dimensions']
                if (!field) return <p className="text-xs text-stone-400">No data for this field.</p>

                const statusColors: Record<string, string> = {
                  verified: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
                  found_single_source: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
                  user: 'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400',
                  ai_estimated: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
                  calculated: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
                  missing: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300',
                }

                return (
                  <div className="space-y-4">
                    {/* Value summary */}
                    <div className="p-3 rounded-lg bg-stone-50 dark:bg-stone-800 border border-stone-200 dark:border-stone-700">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wide">
                          Extracted Value
                        </span>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${statusColors[field.status] || statusColors.missing}`}>
                          {field.status === 'verified'
                            ? `Verified (${field.sources?.length || 1} sources)`
                            : field.status === 'found_single_source'
                            ? 'Found (1 source)'
                            : field.status}
                        </span>
                      </div>
                      <p className="font-mono text-sm font-bold text-stone-900 dark:text-stone-100">
                        {typeof field.value === 'object' && field.value !== null
                          ? Object.entries(field.value)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(' × ')
                          : String(field.value ?? 'Not found')}{' '}
                        {field.unit || ''}
                      </p>
                      {field.conflict_values && field.conflict_values.length > 0 && (
                        <p className="text-[10px] text-amber-600 mt-1">
                          ⚠ Conflicting values found: {field.conflict_values.join(', ')} — using highest-confidence source.
                        </p>
                      )}
                    </div>

                    {/* Source list */}
                    {field.sources && field.sources.length > 0 ? (
                      <div className="space-y-3">
                        <h4 className="text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                          Sources ({field.sources.length})
                        </h4>
                        {(field.sources as SourceEvidence[]).map((src, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 space-y-1"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                {src.is_official && (
                                  <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded font-semibold">
                                    Official
                                  </span>
                                )}
                                <span className="text-[10px] font-semibold text-stone-800 dark:text-stone-200">
                                  {src.source_name}
                                </span>
                              </div>
                              <span className="text-[9px] text-stone-400">
                                {Math.round(src.confidence * 100)}% confidence
                              </span>
                            </div>
                            {src.snippet && (
                              <p className="text-[10px] text-stone-500 dark:text-stone-400 italic border-l-2 border-stone-200 dark:border-stone-700 pl-2">
                                "{src.snippet}"
                              </p>
                            )}
                            <div className="flex items-center justify-between">
                              <a
                                href={src.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[9px] text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[240px]"
                              >
                                {src.source_url}
                              </a>
                              <span className="text-[9px] text-stone-400 whitespace-nowrap ml-2">
                                {src.fetched_at}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-stone-400 text-center py-4">No source evidence recorded for this field.</p>
                    )}
                  </div>
                )
              })()}

              {/* Sources overview */}
              <div className="border-t border-stone-100 dark:border-stone-800 pt-4">
                <h4 className="text-[10px] font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide mb-2">
                  All Sources Checked
                </h4>
                <div className="space-y-1">
                  {candidateSpecs.sources_checked.map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[10px]">
                      <span className="text-stone-600 dark:text-stone-400">{s.source}</span>
                      <span className={`px-1.5 py-0.5 rounded font-semibold ${
                        s.status === 'verified'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                          : s.status === 'partial'
                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                          : 'bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-500'
                      }`}>
                        {s.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/50">
              <p className="text-[9px] text-stone-400 text-center">
                Data retrieved {new Date().toLocaleDateString('en-GB')} · NxtPak AI v1 ·{' '}
                Evaluated against NxtPak ISO registry v1 (see source list). No company-specific requirements loaded.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default NewProject
