import React, { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Center, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore, type ViewMode } from '../../store/projectStore'
import type { PackagingAlternative } from '../../types'

interface PackagingViewer3DProps {
  alternative?: PackagingAlternative | null
  productDims?: { length: number; width: number; height: number } | null
}

const BoxMesh: React.FC<{
  dimensions: [number, number, number]
  color: string
  opacity?: number
  wireframe?: boolean
  label?: string
  edgeColor?: string
}> = ({ dimensions, color, opacity = 1, wireframe = false, label, edgeColor = '#ffffff' }) => {
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
      {label && (
        <Text
          position={[0, dimensions[1] / 2 + 0.08, 0]}
          fontSize={0.08}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      )}
    </group>
  )
}

export const PackagingViewer3D: React.FC<PackagingViewer3DProps> = ({
  alternative,
  productDims,
}) => {
  const { selectedView, setSelectedView } = useProjectStore()
  const [wireframeMode, setWireframeMode] = useState(false)
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top'>('iso')
  const controlsRef = useRef<any>(null)

  // Scale down millimeters to meters for Three.js (1000mm = 1 unit)
  const scale = 0.001

  const pLength = productDims?.length || 300
  const pWidth = productDims?.width || 200
  const pHeight = productDims?.height || 150

  const outerL = (alternative?.outer_length_mm || pLength + 50) * scale
  const outerW = (alternative?.outer_width_mm || pWidth + 50) * scale
  const outerH = (alternative?.outer_height_mm || pHeight + 50) * scale

  const prodL = pLength * scale
  const prodW = pWidth * scale
  const prodH = pHeight * scale

  const insertTh = (alternative?.insert_thickness_mm || 0) * scale
  const hasInserts = insertTh > 0

  const handleSetCameraView = (view: 'iso' | 'front' | 'top') => {
    setCameraView(view)
    if (controlsRef.current) {
      if (view === 'iso') {
        controlsRef.current.object.position.set(1.2, 1.0, 1.4)
      } else if (view === 'front') {
        controlsRef.current.object.position.set(0, 0.4, 2.0)
      } else if (view === 'top') {
        controlsRef.current.object.position.set(0, 2.2, 0.01)
      }
      controlsRef.current.target.set(0, outerH / 2, 0)
      controlsRef.current.update()
    }
  }

  return (
    <div className="relative w-full h-[500px] bg-slate-900 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col">
      {/* Top Left View Mode Toolbar */}
      <div className="absolute top-3 start-3 z-10 flex flex-wrap items-center gap-1.5 bg-slate-800/90 dark:bg-slate-900/90 backdrop-blur-md p-1 rounded-lg border border-slate-700/60 shadow">
        <button
          type="button"
          onClick={() => setSelectedView('box')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'box'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          Box (Outside)
        </button>
        <button
          type="button"
          onClick={() => setSelectedView('inside')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'inside'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          Inside the Box
        </button>
        <button
          type="button"
          onClick={() => setSelectedView('product')}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            selectedView === 'product'
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:text-white hover:bg-slate-700'
          }`}
        >
          Product Alone
        </button>

        <span className="w-px h-4 bg-slate-700 mx-0.5" />

        <button
          type="button"
          onClick={() => setWireframeMode(!wireframeMode)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
            wireframeMode
              ? 'bg-slate-700 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
          }`}
          title="Toggle wireframe mode"
        >
          {wireframeMode ? 'Solid' : 'Wireframe'}
        </button>
      </div>

      {/* Top Right Camera & Live Dimensions */}
      <div className="absolute top-3 end-3 z-10 flex flex-col items-end gap-2 pointer-events-none">
        {/* Camera Preset Buttons */}
        <div className="pointer-events-auto bg-slate-800/90 dark:bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1 shadow text-[11px]">
          <span className="text-slate-400 px-1 font-medium">Angle:</span>
          {(['iso', 'front', 'top'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => handleSetCameraView(mode)}
              className={`px-2 py-0.5 rounded capitalize transition-colors ${
                cameraView === mode
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              {mode === 'iso' ? '3D' : mode}
            </button>
          ))}
        </div>

        {/* Dimensions Card (No fake ISO badge) */}
        <div className="pointer-events-auto bg-slate-800/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-2.5 rounded-lg border border-slate-700/60 text-xs text-slate-300 shadow max-w-[240px]">
          <div className="font-semibold text-slate-100 flex items-center justify-between border-b border-slate-700 pb-1 mb-1.5">
            <span className="text-[11px]">Dimensions (mm)</span>
            <span className="text-[10px] text-slate-400 font-normal">Deterministic</span>
          </div>
          <div className="font-mono text-[11px] space-y-1">
            <div className="flex justify-between items-center gap-3">
              <span className="text-amber-400">Carton:</span>
              <span className="text-slate-100 font-semibold">
                {alternative?.outer_length_mm || Math.round(outerL * 1000)} × {alternative?.outer_width_mm || Math.round(outerW * 1000)} × {alternative?.outer_height_mm || Math.round(outerH * 1000)}
              </span>
            </div>
            {productDims ? (
              <div className="flex justify-between items-center gap-3">
                <span className="text-blue-400">Product:</span>
                <span className="text-slate-300">
                  {pLength} × {pWidth} × {pHeight}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center gap-3 text-slate-400 text-[10px]">
                <span>Product:</span>
                <span>Not entered</span>
              </div>
            )}
            {hasInserts && (
              <div className="flex justify-between items-center gap-3 text-emerald-400 text-[10px]">
                <span>Cushion:</span>
                <span>{alternative?.insert_thickness_mm} mm per side</span>
              </div>
            )}
          </div>
          {/* Color legend */}
          <div className="flex items-center gap-3 pt-2 mt-1.5 border-t border-slate-700 text-[10px]">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> Carton
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" /> Product
            </span>
            {hasInserts && (
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block" /> Cushion
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3D Canvas */}
      <Canvas
        camera={{ position: [1.2, 1.0, 1.4], fov: 45 }}
        className="w-full h-full cursor-grab active:cursor-grabbing"
      >
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 8, 5]} intensity={1.2} />
        <directionalLight position={[-5, -4, -5]} intensity={0.4} />

        <Center top>
          {selectedView === 'box' && (
            <BoxMesh
              dimensions={[outerL, outerH, outerW]}
              color="#d97706"
              opacity={wireframeMode ? 0.35 : 0.95}
              wireframe={wireframeMode}
              label={`${Math.round(outerL * 1000)} × ${Math.round(outerW * 1000)} × ${Math.round(outerH * 1000)} mm`}
            />
          )}

          {selectedView === 'inside' && (
            <group>
              <BoxMesh
                dimensions={[outerL, outerH, outerW]}
                color="#b45309"
                opacity={0.16}
                wireframe={wireframeMode}
              />
              {productDims && (
                <BoxMesh
                  dimensions={[prodL, prodH, prodW]}
                  color="#3b82f6"
                  opacity={wireframeMode ? 0.5 : 0.92}
                  wireframe={wireframeMode}
                  label="Product Envelope"
                />
              )}
              {hasInserts && productDims && (
                <BoxMesh
                  dimensions={[prodL + insertTh * 2, prodH + insertTh * 2, prodW + insertTh * 2]}
                  color="#10b981"
                  opacity={0.25}
                  wireframe={wireframeMode}
                />
              )}
            </group>
          )}

          {selectedView === 'product' && (
            <BoxMesh
              dimensions={[prodL, prodH, prodW]}
              color="#3b82f6"
              opacity={wireframeMode ? 0.5 : 0.92}
              wireframe={wireframeMode}
              label={productDims ? `${pLength} × ${pWidth} × ${pHeight} mm` : 'Default envelope'}
            />
          )}
        </Center>

        <Grid
          position={[0, -0.01, 0]}
          args={[4, 4]}
          cellSize={0.2}
          cellThickness={0.8}
          cellColor="#334155"
          sectionSize={1.0}
          sectionThickness={1.2}
          sectionColor="#475569"
          fadeDistance={3}
          fadeStrength={1}
        />

        <OrbitControls
          ref={controlsRef}
          makeDefault
          enableDamping
          dampingFactor={0.05}
          minDistance={0.5}
          maxDistance={4}
        />
      </Canvas>

      {/* Bottom Hint */}
      <div className="absolute bottom-2.5 start-3 z-10 text-[10px] text-slate-400 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded border border-slate-800 pointer-events-none">
        Left-drag rotate · Scroll zoom · Right-drag pan
      </div>
    </div>
  )
}
