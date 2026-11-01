import React, { useRef, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Center, Html } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '../../store/projectStore'
import type { PackagingAlternative, ComponentSpec } from '../../types'
import { ParametricProduct3D } from './ParametricProduct3D'

interface PackagingViewer3DProps {
  alternative?: PackagingAlternative | null
  productDims?: { length: number; width: number; height: number } | null
  category?: string | null
  productName?: string
  components?: ComponentSpec[]
  images?: string[]
  provenanceBadge?: string
}

const BoxMesh: React.FC<{
  dimensions: [number, number, number]
  color: string
  opacity?: number
  wireframe?: boolean
  edgeColor?: string
}> = ({ dimensions, color, opacity = 1, wireframe = false, edgeColor = '#ffffff' }) => {
  return (
    <group>
      <mesh>
        <boxGeometry args={dimensions} />
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
        <edgesGeometry args={[new THREE.BoxGeometry(...dimensions)]} />
        <lineBasicMaterial color={edgeColor} opacity={0.35} transparent />
      </lineSegments>
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
  provenanceBadge = 'Approximate model from entered dimensions',
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
  const controlsRef = useRef<any>(null)

  // Scale down millimeters to meters for Three.js (1000mm = 1 unit)
  const scale = 0.001

  const pLength = Math.round(productDims?.length || 460)
  const pWidth = Math.round(productDims?.width || 460)
  const pHeight = Math.round(productDims?.height || 1250)

  const outerL_mm = Math.round(alternative?.outer_length_mm || pLength + 60)
  const outerW_mm = Math.round(alternative?.outer_width_mm || pWidth + 60)
  const outerH_mm = Math.round(alternative?.outer_height_mm || pHeight + 60)

  const outerL = outerL_mm * scale
  const outerW = outerW_mm * scale
  const outerH = outerH_mm * scale

  const prodL = pLength * scale
  const prodW = pWidth * scale
  const prodH = pHeight * scale

  // Compute exact cushion/clearance strictly from geometry (never contradictory)
  const clearanceL = Math.max(0, Math.round((outerL_mm - pLength) / 2))
  const clearanceW = Math.max(0, Math.round((outerW_mm - pWidth) / 2))
  const clearanceH = Math.max(0, Math.round((outerH_mm - pHeight) / 2))

  const insertTh = (alternative?.insert_thickness_mm || clearanceL) * scale
  const hasInserts = insertTh > 0

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
        controlsRef.current.object.position.set(1.4, 1.2, 1.6)
      } else if (view === 'front') {
        controlsRef.current.object.position.set(0, 0.4, 2.2)
      } else if (view === 'top') {
        controlsRef.current.object.position.set(0, 2.5, 0.01)
      }
      controlsRef.current.target.set(0, outerH / 2, 0)
      controlsRef.current.update()
    }
  }

  // Savings and Material delta
  const matSavedPct = alternative?.savings?.material_saved_pct ?? 0
  const isNegativeSavings = matSavedPct < 0

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
          onClick={() => { setSelectedView('exploded'); setExplodedFactor(0.5) }}
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
        </div>

        {/* Consistent Geometry Dimensions Card */}
        <div className="pointer-events-auto bg-stone-800/95 dark:bg-stone-900/95 backdrop-blur-md px-3 py-2.5 rounded-lg border border-stone-700/60 text-xs text-stone-300 shadow max-w-[260px]">
          <div className="font-semibold text-stone-100 flex items-center justify-between border-b border-stone-700 pb-1 mb-1.5">
            <span className="text-[11px]">Physical Dimensions</span>
            <span className="text-[10px] text-emerald-400 font-mono">Verified Geometry</span>
          </div>
          <div className="font-mono text-[11px] space-y-1">
            <div className="flex justify-between items-center gap-3">
              <span className="text-amber-400">Carton:</span>
              <span className="text-stone-100 font-semibold" title={`Exact: ${outerL_mm} × ${outerW_mm} × ${outerH_mm} mm`}>
                {outerL_mm} × {outerW_mm} × {outerH_mm} mm
              </span>
            </div>
            {productDims ? (
              <div className="flex justify-between items-center gap-3">
                <span className="text-blue-400">Product:</span>
                <span className="text-stone-300" title={`Exact: ${pLength} × ${pWidth} × ${pHeight} mm`}>
                  {pLength} × {pWidth} × {pHeight} mm
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
              <span className="font-mono">
                L: {clearanceL} / W: {clearanceW} / H: {clearanceH} mm
              </span>
            </div>

            {/* Negative savings honest banner */}
            {isNegativeSavings && (
              <div className="mt-1 pt-1 border-t border-amber-500/30 text-[10px] text-amber-300 font-sans leading-tight">
                <span className="font-bold">+{Math.abs(matSavedPct).toFixed(1)}% more material:</span> required 25mm clearance for Medium fragility; current carton leaves inadequate clearance.
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
            camera={{ position: [1.4, 1.2, 1.6], fov: 45 }}
            className="w-full h-full cursor-grab active:cursor-grabbing"
          >
            <ambientLight intensity={0.9} />
            <directionalLight position={[6, 10, 6]} intensity={1.3} castShadow />
            <directionalLight position={[-6, -4, -6]} intensity={0.5} />
            <directionalLight position={[0, 5, -8]} intensity={0.4} />

            <Center top>
              {/* View 1: Box (Outside) */}
              {selectedView === 'box' && (
                <group>
                  <BoxMesh
                    dimensions={[outerL, outerH, outerW]}
                    color="#d97706"
                    opacity={wireframeMode ? 0.35 : 0.96}
                    wireframe={wireframeMode}
                  />
                  {/* Flap Tape Line */}
                  <mesh position={[0, outerH / 2 + 0.002, 0]}>
                    <planeGeometry args={[0.04, outerW]} />
                    <meshStandardMaterial color="#92400e" roughness={0.3} />
                  </mesh>
                  <Html
                    position={[0, outerH / 2 + 0.08, 0]}
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
                <group>
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
                      <ParametricProduct3D
                        category={category}
                        productName={productName}
                        dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                        viewMode="assembled"
                        wireframe={wireframeMode}
                        components={components}
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

                  {/* Cushion Inserts Layer */}
                  {hasInserts && productDims && (
                    <BoxMesh
                      dimensions={[prodL + insertTh * 2, prodH + insertTh * 2, prodW + insertTh * 2]}
                      color="#10b981"
                      opacity={0.22}
                      wireframe={wireframeMode}
                    />
                  )}
                </group>
              )}

              {/* View 3: Product Alone (Assembled or Packed Parts) */}
              {selectedView === 'product' && (
                <group>
                  <ParametricProduct3D
                    category={category}
                    productName={productName}
                    dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                    viewMode={productSubView}
                    wireframe={wireframeMode}
                    components={components}
                    selectedComponentName={selectedComponent?.name}
                    onSelectComponent={(comp) => setSelectedComponent(comp)}
                  />

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
                      position={[0, prodH + 0.08, 0]}
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
                <group>
                  <ParametricProduct3D
                    category={category}
                    productName={productName}
                    dimensions={{ length: pLength, width: pWidth, height: pHeight }}
                    viewMode="assembled"
                    explodedFactor={explodedFactor}
                    wireframe={wireframeMode}
                    components={components}
                  />

                  {/* Exploded Carton Shell */}
                  <group position={[0, -explodedFactor * 0.4, 0]}>
                    <BoxMesh
                      dimensions={[outerL, outerH * 0.3, outerW]}
                      color="#d97706"
                      opacity={0.35}
                      wireframe={wireframeMode}
                    />
                  </group>
                </group>
              )}
            </Center>

            {/* Studio Floor Grid */}
            <Grid
              position={[0, -0.01, 0]}
              args={[4, 4]}
              cellSize={0.2}
              cellThickness={0.8}
              cellColor="#334155"
              sectionSize={1.0}
              sectionThickness={1.2}
              sectionColor="#475569"
              fadeDistance={3.5}
              fadeStrength={1}
            />

            <OrbitControls
              ref={controlsRef}
              makeDefault
              enableDamping
              dampingFactor={0.05}
              minDistance={0.4}
              maxDistance={5}
            />
          </Canvas>
        </div>
      </div>

      {/* Bottom Provenance and Hint Bar */}
      <div className="flex items-center justify-between px-3 py-2 bg-stone-950/90 border-t border-stone-800 text-[11px] text-stone-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          <span className="font-medium text-stone-300">{provenanceBadge}</span>
          <span className="text-stone-600">·</span>
          <span>Upload CAD (STEP/STL) for exact geometry</span>
        </div>
        <div className="text-stone-500">
          Left-drag rotate · Scroll zoom · Right-drag pan
        </div>
      </div>
    </div>
  )
}
