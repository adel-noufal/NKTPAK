import React, { useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid, Center, Text } from '@react-three/drei'
import * as THREE from 'three'
import { useProjectStore } from '../../store/projectStore'
import type { PackagingAlternative } from '../../types'

interface PackagingViewer3DProps {
  alternative?: PackagingAlternative | null
  productDims?: { length: number; width: number; height: number }
}

const BoxMesh: React.FC<{
  dimensions: [number, number, number]
  color: string
  opacity?: number
  wireframe?: boolean
  label?: string
}> = ({ dimensions, color, opacity = 1, wireframe = false, label }) => {
  return (
    <group>
      <mesh>
        <boxGeometry args={dimensions} />
        <meshStandardMaterial
          color={color}
          transparent={opacity < 1}
          opacity={opacity}
          roughness={0.4}
          metalness={0.1}
          wireframe={wireframe}
        />
      </mesh>
      {/* Subtle border outline for crisp engineering appearance */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(...dimensions)]} />
        <lineBasicMaterial color="#ffffff" opacity={0.3} transparent />
      </lineSegments>
      {label && (
        <Text
          position={[0, dimensions[1] / 2 + 0.15, 0]}
          fontSize={0.12}
          color="#cbd5e1"
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
  productDims = { length: 300, width: 200, height: 150 },
}) => {
  const { selectedView, setSelectedView } = useProjectStore()
  const [wireframeMode, setWireframeMode] = useState(false)
  const [cameraView, setCameraView] = useState<'iso' | 'front' | 'top'>('iso')
  const controlsRef = useRef<any>(null)

  // Scale down millimeters to meters for Three.js scene (1000mm = 1.0 unit)
  const scale = 0.001

  // Outer carton dimensions
  const outerL = (alternative?.outer_length_mm || productDims.length + 50) * scale
  const outerW = (alternative?.outer_width_mm || productDims.width + 50) * scale
  const outerH = (alternative?.outer_height_mm || productDims.height + 50) * scale

  // Product dimensions
  const prodL = productDims.length * scale
  const prodW = productDims.width * scale
  const prodH = productDims.height * scale

  // Inserts / Cushion dimensions (if any)
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
    <div className="relative w-full h-[480px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Left Controls Toolbar */}
      <div className="absolute top-4 start-4 z-10 flex flex-wrap items-center gap-2 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/60 shadow-lg">
        <button
          type="button"
          onClick={() => setSelectedView('exterior')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selectedView === 'exterior'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          📦 Exterior Box
        </button>
        <button
          type="button"
          onClick={() => setSelectedView('interior')}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
            selectedView === 'interior'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
        >
          🔍 Interior Fit
        </button>

        <span className="w-px h-4 bg-slate-700 mx-1 hidden sm:inline-block" />

        <button
          type="button"
          onClick={() => setWireframeMode(!wireframeMode)}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
            wireframeMode
              ? 'bg-indigo-600 text-white'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Toggle wireframe mode"
        >
          🕸️ {wireframeMode ? 'Solid' : 'Wireframe'}
        </button>
      </div>

      {/* Top Right Camera & Dimensions Legend */}
      <div className="absolute top-4 end-4 z-10 flex flex-col items-end gap-2">
        {/* Camera Preset Quick Buttons */}
        <div className="bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-700/60 flex items-center gap-1 shadow-lg text-[11px]">
          <span className="text-slate-400 px-1 font-medium">Angle:</span>
          <button
            type="button"
            onClick={() => handleSetCameraView('iso')}
            className={`px-2 py-0.5 rounded transition-colors ${cameraView === 'iso' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            3D
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('front')}
            className={`px-2 py-0.5 rounded transition-colors ${cameraView === 'front' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Front
          </button>
          <button
            type="button"
            onClick={() => handleSetCameraView('top')}
            className={`px-2 py-0.5 rounded transition-colors ${cameraView === 'top' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            Top
          </button>
        </div>

        {/* Dimensions Card */}
        <div className="bg-slate-900/90 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-slate-700/60 text-xs text-slate-300 shadow-xl flex flex-col gap-1.5 min-w-[210px]">
          <div className="font-semibold text-slate-100 flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="text-xs">Live Dimensions (mm)</span>
            <span className="text-[10px] text-blue-400 font-mono">ISO 2206</span>
          </div>
          <div className="font-mono text-[11px] text-slate-300 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-amber-400 font-semibold">Carton:</span>
              <span className="text-white font-bold">
                {alternative?.outer_length_mm || Math.round(outerL * 1000)} × {alternative?.outer_width_mm || Math.round(outerW * 1000)} × {alternative?.outer_height_mm || Math.round(outerH * 1000)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-400 font-semibold">Product:</span>
              <span className="text-slate-200">
                {productDims.length} × {productDims.width} × {productDims.height}
              </span>
            </div>
            {hasInserts && (
              <div className="flex justify-between text-emerald-400">
                <span>Cushion:</span>
                <span>{alternative?.insert_thickness_mm} mm padding</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1.5 border-t border-slate-800 text-[10px]">
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block shadow-sm" /> Carton
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block shadow-sm" /> Product
            </span>
            {hasInserts && (
              <span className="flex items-center gap-1 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block shadow-sm" /> Cushion
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
        <directionalLight position={[5, 8, 5]} intensity={1.2} castShadow />
        <directionalLight position={[-5, -4, -5]} intensity={0.4} />

        <Center top>
          {selectedView === 'exterior' ? (
            /* Exterior Mode: Cardboard Outer Carton */
            <BoxMesh
              dimensions={[outerL, outerH, outerW]}
              color="#d97706" // Corrugated cardboard amber
              opacity={wireframeMode ? 0.3 : 0.94}
              wireframe={wireframeMode}
              label={`${Math.round(outerL * 1000)} × ${Math.round(outerW * 1000)} × ${Math.round(outerH * 1000)} mm`}
            />
          ) : (
            /* Interior Mode: Translucent Box with Product and Cushions inside */
            <group>
              {/* Ghost outer carton */}
              <BoxMesh
                dimensions={[outerL, outerH, outerW]}
                color="#b45309"
                opacity={0.15}
                wireframe={wireframeMode}
              />
              {/* Product inside */}
              <BoxMesh
                dimensions={[prodL, prodH, prodW]}
                color="#3b82f6" // Product blue
                opacity={wireframeMode ? 0.5 : 0.95}
                wireframe={wireframeMode}
                label="Product Core"
              />
              {/* Optional Cushion Layer around product */}
              {hasInserts && (
                <BoxMesh
                  dimensions={[prodL + insertTh * 2, prodH + insertTh * 2, prodW + insertTh * 2]}
                  color="#10b981" // Cushion emerald
                  opacity={0.25}
                  wireframe={wireframeMode}
                />
              )}
            </group>
          )}
        </Center>

        {/* Floor Grid for perspective */}
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

      {/* Bottom Hint Bar */}
      <div className="absolute bottom-2.5 start-4 z-10 text-[11px] text-slate-400 bg-slate-900/70 backdrop-blur-sm px-3 py-1 rounded-lg border border-slate-800 pointer-events-none flex items-center gap-2">
        <span>💡</span>
        <span>Left-drag to rotate • Scroll to zoom • Right-drag to pan</span>
      </div>
    </div>
  )
}
