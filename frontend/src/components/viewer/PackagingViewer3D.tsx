import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '../../store/projectStore'
import type { PackagingAlternative, ComponentSpec, FragilityClass } from '../../types'
import { ParametricProduct3D } from './ParametricProduct3D'
import { boxSizeLWH, cameraFitDistance, createBoxGeometryLWH, fitObjectToBounds, measureClearance } from './sceneGeometry'
import { resolveProductModel, type ProductModelProject } from './productModel'

type BoxRecord = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; size: { length: number; width: number; height: number } }
type SceneBoxes = { carton: THREE.Box3 | null; innerCarton: THREE.Box3 | null; product: THREE.Box3 | null; productObjectName: string | null }
type FitMetrics = { key: string; center: [number, number, number]; minY: number; radius: number; distance: number; width: number; height: number; near: number; far: number }
declare global { interface Window { __NEXTPAK_3D_DEBUG__?: Record<string, unknown> } }

const CameraAutoFit: React.FC<{
  objectRef: React.RefObject<THREE.Group | null>
  controlsRef: React.RefObject<any>
  fitKey: string
  onFit: (box: THREE.Box3, metrics: FitMetrics) => void
}> = ({ objectRef, controlsRef, fitKey, onFit }) => {
  const { camera, size } = useThree()
  useEffect(() => {
    let firstFrame = 0
    let secondFrame = 0
    firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        const activeObject = objectRef.current
        if (!activeObject || !(camera instanceof THREE.PerspectiveCamera) || size.width < 1 || size.height < 1) return
        activeObject.updateWorldMatrix(true, true)
        const bounds = new THREE.Box3().setFromObject(activeObject)
        if (bounds.isEmpty()) return
        const sphere = bounds.getBoundingSphere(new THREE.Sphere())
        const distance = cameraFitDistance(sphere.radius, camera.fov, 1.3)
        const direction = new THREE.Vector3(1, 0.72, 1).normalize()
        camera.position.copy(sphere.center).addScaledVector(direction, distance)
        camera.near = Math.max(0.1, distance / 1000)
        camera.far = Math.max(10000, distance * 20)
        camera.updateProjectionMatrix()
        const controls = controlsRef.current
        if (controls) {
          controls.target.copy(sphere.center)
          controls.minDistance = Math.max(1, sphere.radius * 0.08)
          controls.maxDistance = Math.max(distance * 8, controls.minDistance * 10)
          controls.update()
        }
        onFit(bounds.clone(), { key: fitKey, center: [sphere.center.x, sphere.center.y, sphere.center.z], minY: bounds.min.y, radius: sphere.radius, distance, width: size.width, height: size.height, near: camera.near, far: camera.far })
      })
    })
    return () => { cancelAnimationFrame(firstFrame); cancelAnimationFrame(secondFrame) }
  }, [camera, controlsRef, fitKey, objectRef, onFit, size.width, size.height])
  return null
}

interface PackagingViewer3DProps {
  alternative?: PackagingAlternative | null
  productDims?: { length: number; width: number; height: number } | null
  category?: string | null
  productName?: string
  components?: ComponentSpec[]
  images?: string[]
  modelProject: ProductModelProject
  fragilityClass: FragilityClass
  requiredClearanceMm: number
  onEditProduct?: () => void
  onAddParts?: () => void
}

const BoxMesh: React.FC<{
  dimensions: [number, number, number]
  color: string
  opacity?: number
  wireframe?: boolean
  edgeColor?: string
  visible?: boolean
  onMeasure?: (box: THREE.Box3) => void
}> = ({ dimensions, color, opacity = 1, wireframe = false, edgeColor = '#ffffff', visible = true, onMeasure }) => {
  const ref = useRef<THREE.Group>(null)
  const [length, height, width] = dimensions
  const boxDims = useMemo(() => ({ length, height, width }), [length, height, width])
  const geometry = useMemo(() => createBoxGeometryLWH(boxDims), [boxDims])
  useLayoutEffect(() => {
    if (!ref.current || !onMeasure) return
    ref.current.updateWorldMatrix(true, true)
    onMeasure(new THREE.Box3().setFromObject(ref.current).clone())
  }, [geometry, onMeasure])
  return (
    <group ref={ref} visible={visible}>
      <mesh>
        <primitive object={geometry} attach="geometry" />
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.5}
          metalness={0.1}
          wireframe={wireframe}
        />
      </mesh>
      <lineSegments>
        <edgesGeometry args={[geometry]} />
        <lineBasicMaterial color={edgeColor} opacity={0.35} transparent />
      </lineSegments>
    </group>
  )
}

const MeasuredProduct: React.FC<{
  dimensions: { length: number; width: number; height: number }
  resolvedModel: ReturnType<typeof resolveProductModel>['model']
  viewMode: 'assembled' | 'packed_parts' | 'exploded'
  explodedFactor: number
  components: ComponentSpec[]
  wireframe: boolean
  visible: boolean
  onMeasure: (box: THREE.Box3, objectName: string) => void
  onSelectComponent?: (comp: ComponentSpec) => void
  selectedComponentName?: string | null
}> = ({ dimensions, resolvedModel, viewMode, explodedFactor, components, wireframe, visible, onMeasure, onSelectComponent, selectedComponentName }) => {
  const ref = useRef<THREE.Group>(null)
  const componentsKey = components.map((component) => `${component.name}:${component.length_mm}:${component.width_mm}:${component.height_mm}`).join('|')
  useLayoutEffect(() => {
    const object = ref.current
    if (!object) return
    object.scale.setScalar(1000)
    object.updateWorldMatrix(true, true)
    const box = fitObjectToBounds(object, new THREE.Vector3(dimensions.length, dimensions.height, dimensions.width))
    onMeasure(box.clone(), object.name)
  }, [dimensions.length, dimensions.width, dimensions.height, resolvedModel, viewMode, explodedFactor, componentsKey, onMeasure])
  const effectiveView = viewMode === 'packed_parts' && components.length === 0 ? 'assembled' : viewMode
  return <group ref={ref} visible={visible} name={`product-model-${resolvedModel}`}>
    <ParametricProduct3D
      resolvedModel={resolvedModel}
      dimensions={dimensions}
      viewMode={effectiveView}
      explodedFactor={explodedFactor}
      wireframe={wireframe}
      components={components}
      onSelectComponent={onSelectComponent}
      selectedComponentName={selectedComponentName}
    />
  </group>
}

const FoamPads: React.FC<{
  length: number
  width: number
  height: number
  thickness: number
  materialName?: string
  wireframe: boolean
}> = ({ length, width, height, thickness, materialName = '', wireframe }) => {
  const normalized = materialName.toLowerCase()
  const color = normalized.includes('epe') || normalized.includes('polyethylene')
    ? '#22d3ee'
    : normalized.includes('eps') || normalized.includes('polystyrene')
      ? '#93c5fd'
      : normalized.includes('epp') || normalized.includes('polypropylene')
        ? '#a78bfa'
        : normalized.includes('pulp') || normalized.includes('kraft') || normalized.includes('paper')
          ? '#d6a86a'
          : normalized.includes('polyurethane')
            ? '#fbbf24'
            : '#10b981'
  return (
    <group name="foam-insert-pads">
      <group position={[-(length + thickness) / 2, 0, 0]}>
        <BoxMesh dimensions={[thickness, height, width]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
      <group position={[(length + thickness) / 2, 0, 0]}>
        <BoxMesh dimensions={[thickness, height, width]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
      <group position={[0, 0, -(width + thickness) / 2]}>
        <BoxMesh dimensions={[length, height, thickness]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
      <group position={[0, 0, (width + thickness) / 2]}>
        <BoxMesh dimensions={[length, height, thickness]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
      <group position={[0, -(height + thickness) / 2, 0]}>
        <BoxMesh dimensions={[length + 2 * thickness, thickness, width + 2 * thickness]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
      <group position={[0, (height + thickness) / 2, 0]}>
        <BoxMesh dimensions={[length + 2 * thickness, thickness, width + 2 * thickness]} color={color} opacity={0.78} wireframe={wireframe} />
      </group>
    </group>
  )
}

export const PackagingViewer3D: React.FC<PackagingViewer3DProps> = ({
  alternative,
  productDims,
  category,
  productName,
  components = [],
  images = [],
  modelProject,
  fragilityClass,
  requiredClearanceMm,
  onEditProduct = () => undefined,
  onAddParts = () => undefined,
}) => {
  const { selectedView, setSelectedView } = useProjectStore()
  const [wireframeMode, setWireframeMode] = useState(false)
  const [showBoundingBox, setShowBoundingBox] = useState(false)
  const [productSubView, setProductSubView] = useState<'assembled' | 'packed_parts'>('assembled')
  const [explodedFactor, setExplodedFactor] = useState(0)
  const [sideBySide, setSideBySide] = useState(false)
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0)
  const [selectedComponent, setSelectedComponent] = useState<ComponentSpec | null>(null)
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top'>('iso')
  const [fitRequest, setFitRequest] = useState(0)
  const [fitMetrics, setFitMetrics] = useState<FitMetrics | null>(null)
  const [sceneBoxes, setSceneBoxes] = useState<SceneBoxes>({ carton: null, innerCarton: null, product: null, productObjectName: null })
  const sceneRootRef = useRef<THREE.Group>(null)
  const activeViewRef = useRef<THREE.Group>(null)
  const controlsRef = useRef<any>(null)

  // Every scene object uses millimetres: +X length, +Y height, +Z width.
  const scale = 1

  const pLength = productDims?.length ?? Number.NaN
  const pWidth = productDims?.width ?? Number.NaN
  const pHeight = productDims?.height ?? Number.NaN

  const outerL_mm = alternative?.outer_length_mm ?? Number.NaN
  const outerW_mm = alternative?.outer_width_mm ?? Number.NaN
  const outerH_mm = alternative?.outer_height_mm ?? Number.NaN

  const validDimensions = (dims: { length: number | null; width: number | null; height: number | null }) =>
    [dims.length, dims.width, dims.height].every((value) => typeof value === 'number' && Number.isFinite(value) && value > 0)
  const hasProductDimensions = validDimensions({ length: pLength, width: pWidth, height: pHeight })
  const hasCartonDimensions = validDimensions({ length: outerL_mm, width: outerW_mm, height: outerH_mm })
  const hasRenderableDimensions = hasProductDimensions && hasCartonDimensions
  const fitKey = [selectedView, productSubView, explodedFactor, fitRequest, alternative?.alternative_id, outerL_mm, outerW_mm, outerH_mm, pLength, pWidth, pHeight].join(':')

  const outerL = outerL_mm * scale
  const outerW = outerW_mm * scale
  const outerH = outerH_mm * scale

  const prodL = pLength * scale
  const prodW = pWidth * scale
  const prodH = pHeight * scale

  // Compute exact cushion/clearance strictly from geometry (never contradictory)
  const clearanceL = Math.max(0, (outerL_mm - pLength) / 2)
  const clearanceW = Math.max(0, (outerW_mm - pWidth) / 2)
  const clearanceH = Math.max(0, (outerH_mm - pHeight) / 2)

  const insertTh = (alternative?.insert_thickness_mm ?? 0) * scale
  const hasInserts = insertTh > 0
  const productType = modelProject.product_type || 'other'
  const modelResolution = resolveProductModel(modelProject)
  const recordBox = useCallback((key: 'carton' | 'innerCarton' | 'product', box: THREE.Box3, objectName?: string) => {
    setSceneBoxes((current) => ({ ...current, [key]: box.clone(), ...(key === 'product' ? { productObjectName: objectName || null } : {}) }))
  }, [])
  const recordCarton = useCallback((box: THREE.Box3) => recordBox('carton', box), [recordBox])
  const recordInner = useCallback((box: THREE.Box3) => recordBox('innerCarton', box), [recordBox])
  const recordProduct = useCallback((box: THREE.Box3, objectName: string) => recordBox('product', box, objectName), [recordBox])
  const recordFit = useCallback((_box: THREE.Box3, metrics: FitMetrics) => setFitMetrics(metrics), [])
  const measuredCarton = sceneBoxes.carton ? boxSizeLWH(sceneBoxes.carton) : { length: outerL_mm, width: outerW_mm, height: outerH_mm }
  const measuredProduct = sceneBoxes.product ? boxSizeLWH(sceneBoxes.product) : { length: pLength, width: pWidth, height: pHeight }
  const measuredClearance = sceneBoxes.innerCarton && sceneBoxes.product
    ? measureClearance(sceneBoxes.innerCarton, sceneBoxes.product)
    : { length: [clearanceL, clearanceL], width: [clearanceW, clearanceW], height: [clearanceH, clearanceH] }
  const clearanceMeetsTarget = hasRenderableDimensions && !!sceneBoxes.product && !!sceneBoxes.innerCarton && Object.values(measuredClearance).flat().every((gap) => gap >= requiredClearanceMm)
  const serializeBox = (box: THREE.Box3 | null): BoxRecord | null => box ? ({
    min: box.min.toArray().slice(0, 3).reduce((acc, value, axis) => ({ ...acc, [['x', 'y', 'z'][axis]]: value }), {} as BoxRecord['min']),
    max: box.max.toArray().slice(0, 3).reduce((acc, value, axis) => ({ ...acc, [['x', 'y', 'z'][axis]]: value }), {} as BoxRecord['max']),
    size: boxSizeLWH(box),
  }) : null
  useEffect(() => {
    const sceneObjectNames: string[] = []
    sceneRootRef.current?.traverse((object) => {
      if (object.name) sceneObjectNames.push(object.name)
      else if ((object as THREE.Mesh).geometry) sceneObjectNames.push(object.type)
    })
    window.__NEXTPAK_3D_DEBUG__ = {
      view: selectedView === 'product' && productSubView === 'packed_parts' ? 'packed_parts' : selectedView,
      candidateId: alternative?.alternative_id ?? null,
      productType,
      resolvedModel: modelResolution,
      productObjectName: sceneBoxes.productObjectName,
      sceneObjectNames,
      separation: explodedFactor,
      cartonBox: serializeBox(sceneBoxes.carton),
      innerCartonBox: serializeBox(sceneBoxes.innerCarton),
      productBox: serializeBox(sceneBoxes.product),
      clearanceMm: measuredClearance,
      fit: fitMetrics,
      fitKey,
    }
  }, [selectedView, productSubView, alternative?.alternative_id, productType, modelResolution, explodedFactor, sceneBoxes, measuredClearance, fitMetrics, fitKey])

  const getProxiedUrl = (url: string) => {
    if (!url) return ''
    if (url.startsWith('/api') || url.startsWith('data:') || url.startsWith('blob:') || url.includes('unsplash.com')) {
      return url
    }
    return `/api/v1/image-proxy?url=${encodeURIComponent(url)}`
  }

  // Official El Araby product gallery photos
  const photoList = useMemo(() => {
    if (images && images.length > 0) return images
    const norm = `${category || ''} ${productName || ''}`.toLowerCase()
    if (norm.includes('tsf-16w') || (norm.includes('tornado') && norm.includes('16w'))) {
      return [
        'https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-front.jpg',
        'https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-side.jpg',
        'https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-box.jpg',
      ]
    }
    if (norm.includes('tsf') || norm.includes('fan')) {
      return [
        'https://www.elarabygroup.com/media/catalog/product/t/s/tsf-16w-front.jpg',
        'https://images.unsplash.com/photo-1618941716939-553df3c6c278?w=500&auto=format&fit=crop&q=60',
      ]
    }
    if (norm.includes('bl500') || norm.includes('blender')) {
      return [
        'https://www.elarabygroup.com/media/catalog/product/b/l/bl500-2-main.jpg',
      ]
    }
    if (norm.includes('vh-720') || norm.includes('wash')) {
      return [
        'https://www.elarabygroup.com/media/catalog/product/v/h/vh-720.jpg',
      ]
    }
    if (norm.includes('43es') || norm.includes('tv') || norm.includes('screen')) {
      return [
        'https://www.elarabygroup.com/media/catalog/product/4/3/43es9500e.jpg',
      ]
    }
    return [
      'https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=500&auto=format&fit=crop&q=60',
    ]
  }, [images, category, productName])

  const handleSetCameraView = (view: 'iso' | 'front' | 'top') => {
    setCameraView(view)
    if (controlsRef.current) {
      if (view === 'iso') {
        controlsRef.current.object.position.set(outerL * 1.7, outerH * 1.4, outerW * 1.8)
      } else if (view === 'front') {
        controlsRef.current.object.position.set(0, 0, outerW * 2.5)
      } else if (view === 'top') {
        controlsRef.current.object.position.set(0, outerH * 2.5, 1)
      }
      controlsRef.current.target.set(0, 0, 0)
      controlsRef.current.update()
    }
  }

  // Savings and Material delta
  const matSavedPct = alternative?.savings?.material_saved_pct ?? 0
  const isNegativeSavings = matSavedPct < 0

  if (!hasProductDimensions || !hasCartonDimensions) {
    const message = !hasProductDimensions
      ? 'Product dimensions are missing — enter them'
      : 'Carton dimensions are missing — enter them'
    return (
      <div className="min-h-[360px] rounded-xl border border-amber-300 bg-amber-50 p-8 text-center dark:border-amber-800 dark:bg-amber-950/30">
        <h3 className="text-base font-semibold text-amber-950 dark:text-amber-100">3D model unavailable</h3>
        <p role="alert" data-testid="missing-dimensions-message" className="mt-2 text-sm text-amber-900 dark:text-amber-200">{message}</p>
        <button type="button" onClick={onEditProduct} className="mt-4 rounded-md bg-amber-700 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">Edit product dimensions</button>
      </div>
    )
  }

  return (
    <div className="relative w-full rounded-xl overflow-hidden border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col bg-stone-900">
      {/* Top Left View Mode Toolbar */}
      <div className="absolute top-3 start-3 z-10 flex flex-wrap items-center gap-1.5 bg-stone-800/95 dark:bg-stone-900/95 backdrop-blur-md p-1.5 rounded-lg border border-stone-700/60 shadow">
        <button
          type="button"
          onClick={() => { setSelectedView('box'); setExplodedFactor(0) }}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'box'
              ? 'bg-amber-600 text-white font-semibold shadow-sm'
              : 'text-stone-300 hover:text-white hover:bg-stone-700'
          }`}
        >
          Box (Outside)
        </button>
        <button
          type="button"
          onClick={() => { setSelectedView('inside'); setExplodedFactor(0) }}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'inside'
              ? 'bg-amber-600 text-white font-semibold shadow-sm'
              : 'text-stone-300 hover:text-white hover:bg-stone-700'
          }`}
        >
          Inside the Box
        </button>
        <button
          type="button"
          onClick={() => setSelectedView('product')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'product'
              ? 'bg-blue-600 text-white font-semibold shadow-sm'
              : 'text-stone-300 hover:text-white hover:bg-stone-700'
          }`}
        >
          Product Alone
        </button>
        <button
          type="button"
          onClick={() => { setSelectedView('exploded'); setExplodedFactor(0) }}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'exploded'
              ? 'bg-emerald-600 text-white font-semibold shadow-sm'
              : 'text-stone-300 hover:text-white hover:bg-stone-700'
          }`}
        >
          Exploded View
        </button>

        <span className="w-px h-4 bg-stone-700 mx-0.5" />

        {/* Sub-modes for Product Alone */}
        {selectedView === 'product' && (
          <div className="flex items-center gap-1 bg-stone-950/70 p-0.5 rounded border border-stone-700/60">
            <button
              type="button"
              onClick={() => setProductSubView('assembled')}
              className={`px-2 py-1 rounded text-[11px] font-medium ${
                productSubView === 'assembled' ? 'bg-blue-600 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Assembled
            </button>
            <button
              type="button"
              onClick={() => setProductSubView('packed_parts')}
              className={`px-2 py-1 rounded text-[11px] font-medium ${
                productSubView === 'packed_parts' ? 'bg-blue-600 text-white' : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              Packed Parts
            </button>
          </div>
        )}

        {/* Bounding Box Wireframe Overlay Toggle */}
        <button
          type="button"
          onClick={() => setShowBoundingBox(!showBoundingBox)}
          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            showBoundingBox
              ? 'bg-stone-700 text-amber-300 font-semibold border border-amber-500/40'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-700'
          }`}
          title="Toggle thin bounding box wireframe outline with dimension lines"
        >
          Bounding Box: {showBoundingBox ? 'ON' : 'OFF'}
        </button>

        {/* Side by Side Reference Mode Toggle */}
        <button
          type="button"
          onClick={() => setSideBySide(!sideBySide)}
          className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
            sideBySide
              ? 'bg-stone-700 text-blue-300 font-semibold border border-blue-500/40'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-700'
          }`}
          title="Compare 3D model side-by-side with reference photo"
        >
          Side-by-Side: {sideBySide ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Exploded Slider Bar when in Exploded View */}
      {selectedView === 'exploded' && (
        <div className="absolute top-16 start-3 z-10 flex items-center gap-2 bg-stone-800/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-stone-700 text-xs text-stone-300 shadow">
          <span>Pack-out / Separation:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={explodedFactor}
            onChange={(e) => setExplodedFactor(parseFloat(e.target.value))}
            className="w-28 accent-emerald-500 cursor-pointer"
          />
          <span className="font-mono text-[11px] text-emerald-400">
            {Math.round(explodedFactor * 100)}%
          </span>
        </div>
      )}

      {/* Top Right Camera & Geometry Dimensions Card */}
      <div className="absolute top-3 end-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
        {/* Camera Preset Buttons */}
        <div className="pointer-events-auto bg-stone-800/95 dark:bg-stone-900/95 backdrop-blur-md px-2 py-1 rounded-lg border border-stone-700/60 flex items-center gap-1 shadow text-[11px]">
          {(['iso', 'front', 'top'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSetCameraView(mode)}
              className={`px-2 py-1 rounded font-medium capitalize transition-colors ${
                cameraView === mode
                  ? 'bg-stone-700 text-white font-semibold'
                  : 'text-stone-300 hover:bg-stone-700'
              }`}
            >
              {mode === 'iso' ? '3D' : mode}
            </button>
          ))}
          <button type="button" onClick={() => setFitRequest((value) => value + 1)} aria-label="Reset view" className="ms-1 rounded px-2 py-1 text-stone-300 hover:bg-stone-700">Reset view</button>
        </div>

        {/* Consistent Geometry Dimensions Card */}
        <div className="pointer-events-auto bg-stone-800/95 dark:bg-stone-900/95 backdrop-blur-md px-3 py-2.5 rounded-lg border border-stone-700/60 text-xs text-stone-300 shadow max-w-[260px]">
          <div className="font-semibold text-stone-100 flex items-center justify-between border-b border-stone-700 pb-1 mb-1.5">
            <span className="text-[11px]">Physical Dimensions</span>
          </div>
          <div className="font-mono text-[11px] space-y-1">
            <div className="flex justify-between items-center gap-3">
              <span className="text-amber-400">Carton:</span>
              <span data-testid="carton-dimensions" className="text-stone-100 font-semibold" title="Measured from carton Box3">
                {measuredCarton.length.toFixed(1)} × {measuredCarton.width.toFixed(1)} × {measuredCarton.height.toFixed(1)} mm
              </span>
            </div>
            {productDims ? (
              <div className="flex justify-between items-center gap-3">
                <span className="text-blue-400">Product:</span>
                <span data-testid="product-dimensions" className="text-stone-300" title="Measured from product Box3">
                  {measuredProduct.length.toFixed(1)} × {measuredProduct.width.toFixed(1)} × {measuredProduct.height.toFixed(1)} mm
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center gap-3 text-stone-400 text-[10px]">
                <span>Product:</span>
                <span>Not entered</span>
              </div>
            )}
            {/* Clearance strictly computed from geometry */}
            <div className="flex justify-between items-center gap-2 text-emerald-400 text-[10px] pt-0.5 border-t border-stone-700/60">
              <span>Cushion / side:</span>
              <span data-testid="clearance-dimensions" className="font-mono">
                L: {measuredClearance.length.map((n) => n.toFixed(1)).join(' / ')} · W: {measuredClearance.width.map((n) => n.toFixed(1)).join(' / ')} · H: {measuredClearance.height.map((n) => n.toFixed(1)).join(' / ')} mm
              </span>
            </div>
            <div data-testid="clearance-target-status" className={`text-[10px] ${clearanceMeetsTarget ? 'text-emerald-400' : 'text-rose-400'}`}>
              {clearanceMeetsTarget ? 'Clearance target met' : sceneBoxes.product && sceneBoxes.innerCarton ? `Below ${fragilityClass} clearance target (${requiredClearanceMm} mm)` : 'Clearance not measured'}
            </div>

            {/* Negative savings honest banner */}
            {isNegativeSavings && (
              <div className="mt-1 pt-1 border-t border-amber-500/30 text-[10px] text-amber-300 font-sans leading-tight">
                <span className="font-bold">{fragilityClass} protection target: {requiredClearanceMm} mm per side.</span> Measured gaps are shown above.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area: Side-by-Side or Full Canvas */}
      <div className="flex w-full h-[540px]">
        {/* Left Side: Reference Photo in Side-by-Side Mode */}
        {sideBySide && (
          <div className="w-1/3 h-full bg-stone-950 border-e border-stone-800 p-3 flex flex-col justify-between z-10">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-stone-300">Reference Photo</span>
                <span className="text-[10px] text-stone-500">Photo 1 of {photoList.length}</span>
              </div>
              <div className="w-full aspect-square bg-stone-900 rounded-lg overflow-hidden border border-stone-800 flex items-center justify-center relative">
                <img
                  src={getProxiedUrl(photoList[selectedPhotoIndex] || photoList[0])}
                  alt="Reference Product"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    // Fallback to placeholder if proxy or remote image fails
                    ;(e.target as HTMLElement).style.display = 'none'
                  }}
                />
              </div>
            </div>

            {/* Thumbnail Strip */}
            {photoList.length > 1 && (
              <div className="flex gap-2 pt-2 overflow-x-auto">
                {photoList.map((ph, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedPhotoIndex(idx)}
                    className={`w-12 h-12 rounded border flex-shrink-0 overflow-hidden ${
                      selectedPhotoIndex === idx ? 'border-blue-500 ring-2 ring-blue-500/30' : 'border-stone-800 opacity-60 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={getProxiedUrl(ph)}
                      alt={`Thumb ${idx}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = 'none'
                      }}
                    />
                  </button>
                ))}
              </div>
            )}

            <p className="text-[10px] text-stone-400 mt-2">
              Compare real product geometry and contact points with the deterministic 3D layout.
            </p>
          </div>
        )}

        {/* 3D Canvas */}
        <div className="flex-1 h-full relative">
          <Canvas
            camera={{ position: [1, 1, 1], fov: 45, near: 0.1, far: 10000 }}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            <ambientLight intensity={1.1} />
            <directionalLight position={[1200, 1800, 1100]} intensity={1.6} castShadow />
            <directionalLight position={[-900, 600, -700]} intensity={0.7} />
            <directionalLight position={[0, 1000, -1200]} intensity={0.55} />

            <group ref={sceneRootRef} name="millimetre-scene-x-length-y-height-z-width">
              <BoxMesh dimensions={[outerL, outerH, outerW]} color="#d97706" opacity={0} visible={false} onMeasure={recordCarton} />
              <BoxMesh dimensions={[alternative?.inner_length_mm ?? Math.max(0, outerL - 2 * (alternative?.board_thickness_mm ?? 0)), alternative?.inner_height_mm ?? Math.max(0, outerH - 2 * (alternative?.board_thickness_mm ?? 0)), alternative?.inner_width_mm ?? Math.max(0, outerW - 2 * (alternative?.board_thickness_mm ?? 0))]} color="#d97706" opacity={0} visible={false} onMeasure={recordInner} />
              {selectedView === 'box' && productDims && <MeasuredProduct dimensions={{ length: pLength, width: pWidth, height: pHeight }} resolvedModel={modelResolution.model} viewMode="assembled" explodedFactor={0} components={components} wireframe={wireframeMode} visible={false} onMeasure={recordProduct} />}
              {/* View 1: Box (Outside) */}
              {selectedView === 'box' && (
                <group ref={activeViewRef}>
                  <BoxMesh
                    dimensions={[outerL, outerH, outerW]}
                    color="#d97706"
                    opacity={wireframeMode ? 0.35 : 0.96}
                    wireframe={wireframeMode}
                  />
                  {/* Flap Tape Line */}
                  <mesh position={[0, outerH / 2 + 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[40, outerW]} />
                    <meshStandardMaterial color="#92400e" roughness={0.3} />
                  </mesh>
                  <Html
                    position={[0, outerH / 2 + 80, 0]}
                    center
                    style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
                  >
                    <span style={{
                      fontSize: '10px',
                      background: 'rgba(30,41,59,0.85)',
                      color: '#fbbf24',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                    }}>
                      {outerL_mm} × {outerW_mm} × {outerH_mm} mm
                    </span>
                  </Html>
                </group>
              )}

              {/* View 2: Inside the Box */}
              {selectedView === 'inside' && (
                <group ref={activeViewRef}>
                  {/* Semi-transparent Carton Shell */}
                  <BoxMesh
                    dimensions={[outerL, outerH, outerW]}
                    color="#b45309"
                    opacity={0.16}
                    wireframe={wireframeMode}
                  />

                  {/* Parametric Realistic Product Inside Carton */}
                  {productDims && (
                    <group>
                      <MeasuredProduct
                        resolvedModel={modelResolution.model}
                        dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                        viewMode="assembled"
                        explodedFactor={0}
                        wireframe={wireframeMode}
                        components={components}
                        visible
                        onMeasure={recordProduct}
                      />

                      {/* Optional Bounding Box Overlay */}
                      {showBoundingBox && (
                        <BoxMesh
                          dimensions={[prodL, prodH, prodW]}
                          color="#3b82f6"
                          opacity={0.18}
                          wireframe={true}
                          edgeColor="#60a5fa"
                        />
                      )}
                    </group>
                  )}

                  {/* Face pads are separate solids so the product and each insert remain visible. */}
                  {hasInserts && productDims && (
                    <FoamPads
                      length={prodL}
                      width={prodW}
                      height={prodH}
                      thickness={insertTh}
                      materialName={alternative?.foam_material}
                      wireframe={wireframeMode}
                    />
                  )}
                </group>
              )}

              {/* View 3: Product Alone (Assembled or Packed Parts) */}
              {selectedView === 'product' && (
                <group ref={activeViewRef}>
                  {hasInserts && productDims && productSubView === 'packed_parts' && <FoamPads length={prodL} width={prodW} height={prodH} thickness={insertTh} materialName={alternative?.foam_material} wireframe={wireframeMode} />}
                  {productSubView === 'packed_parts' && components.length === 0 ? (
                    <Html center>
                      <div className="w-64 rounded-lg border border-amber-300 bg-stone-950/95 p-4 text-center text-white shadow-xl">
                        <p className="text-xs">No component list for this product. Add parts, or use Assembled.</p>
                        <button type="button" onClick={onAddParts} className="mt-3 rounded bg-amber-700 px-3 py-1.5 text-xs font-semibold">Add parts</button>
                      </div>
                    </Html>
                  ) : <MeasuredProduct
                    resolvedModel={modelResolution.model}
                    dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                    viewMode={productSubView}
                    explodedFactor={0}
                    wireframe={wireframeMode}
                    components={components}
                    selectedComponentName={selectedComponent?.name}
                    onSelectComponent={setSelectedComponent}
                    visible
                    onMeasure={recordProduct}
                  />}

                  {/* Optional Bounding Box Wireframe Overlay */}
                  {showBoundingBox && (
                    <BoxMesh
                      dimensions={[prodL, prodH, prodW]}
                      color="#3b82f6"
                      opacity={0.25}
                      wireframe={true}
                      edgeColor="#60a5fa"
                    />
                  )}

                  {/* Dimension Label as HTML */}
                  {productDims && (
                    <Html
                      position={[0, prodH / 2 + 60, 0]}
                      center
                      style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}
                    >
                      <span style={{
                        fontSize: '10px',
                        background: 'rgba(30,41,59,0.85)',
                        color: '#93c5fd',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontFamily: 'monospace',
                      }}>
                        {pLength} × {pWidth} × {pHeight} mm
                      </span>
                    </Html>
                  )}
                </group>
              )}

              {/* View 4: Exploded View with Sequence Slider */}
              {selectedView === 'exploded' && (
                <group ref={activeViewRef}>
                  <MeasuredProduct
                    resolvedModel={modelResolution.model}
                    dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                    viewMode="assembled"
                    explodedFactor={explodedFactor}
                    wireframe={wireframeMode}
                    components={components}
                    visible
                    onMeasure={recordProduct}
                  />

                  {hasInserts && <FoamPads length={prodL} width={prodW} height={prodH} thickness={insertTh} materialName={alternative?.foam_material} wireframe={wireframeMode} />}

                  {/* Exploded Carton Shell */}
                  <group position={[0, -explodedFactor * outerH * 0.5, 0]}>
                    <BoxMesh
                      dimensions={[outerL, outerH, outerW]}
                      color="#d97706"
                      opacity={0.35}
                      wireframe={wireframeMode}
                    />
                  </group>
                </group>
              )}
            </group>

            {/* Studio Floor Grid */}
            <Grid
              position={[fitMetrics?.center[0] ?? 0, (fitMetrics?.minY ?? -outerH / 2) - 1, fitMetrics?.center[2] ?? 0]}
              args={[Math.max(outerL, outerW) * 3, Math.max(outerL, outerW) * 3]}
              cellSize={100}
              cellThickness={0.8}
              cellColor="#334155"
              sectionSize={500}
              sectionThickness={1.2}
              sectionColor="#475569"
              fadeDistance={Math.max(outerL, outerW, outerH) * 3}
              fadeStrength={1}
            />

            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.05}
              enablePan
              screenSpacePanning
              minDistance={Math.max(1, Math.min(outerL, outerW, outerH) * 0.01)}
              maxDistance={Math.max(outerL, outerW, outerH) * 20}
            />
            <CameraAutoFit objectRef={activeViewRef} controlsRef={controlsRef} fitKey={fitKey} onFit={recordFit} />
          </Canvas>
        </div>
      </div>

      {selectedView === 'product' && productSubView === 'packed_parts' && components.length > 0 && (
        <div data-testid="packed-parts-legend" className="absolute bottom-12 start-3 z-10 max-h-44 w-64 overflow-y-auto rounded-lg border border-stone-700 bg-stone-950/95 p-2 text-xs text-white shadow-xl">
          <p className="mb-1 font-semibold">Parts in this product</p>
          {components.map((component) => <button key={component.name} type="button" onClick={() => setSelectedComponent(component)} className={`block w-full truncate rounded px-2 py-1 text-start ${selectedComponent?.name === component.name ? 'bg-blue-800' : 'hover:bg-stone-800'}`}>{component.name}</button>)}
          {selectedComponent && <p data-testid="selected-part-details" className="mt-2 border-t border-stone-700 pt-2 text-[10px]">{selectedComponent.name} · {selectedComponent.length_mm} × {selectedComponent.width_mm} × {selectedComponent.height_mm} mm · {selectedComponent.weight_kg} kg</p>}
        </div>
      )}

      {/* Bottom Provenance and Hint Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-950/90 border-t border-stone-800 text-[11px] text-stone-400">
        <div className="flex items-center gap-2">
          {modelResolution.isApproximate && <span data-testid="geometry-source" title={modelResolution.tooltip} className="rounded-full border border-stone-700 px-2 py-0.5 text-[10px] text-stone-300">{modelResolution.label} ⓘ</span>}
        </div>
        <div className="text-stone-500">
          Left-drag rotate · Scroll zoom · Right-drag pan
        </div>
      </div>
    </div>
  )
}
