import React, { useMemo } from 'react'
import * as THREE from 'three'
import { Html } from '@react-three/drei'
import type { ComponentSpec } from '../../types'

interface ParametricProductProps {
  category?: string | null
  productName?: string
  dimensions: { length: number; width: number; height: number }
  viewMode: 'assembled' | 'packed_parts' | 'exploded'
  explodedFactor?: number // 0 (assembled) to 1 (fully exploded)
  wireframe?: boolean
  components?: ComponentSpec[]
  onSelectComponent?: (comp: ComponentSpec) => void
  selectedComponentName?: string | null
}

/**
 * High-fidelity Stand Fan (e.g. Tornado TSF-16W / Toshiba EFS-111).
 * Composed of round pedestal base, telescopic stainless steel pole,
 * motor housing with tilt pivot, 4 curved aerofoil blades, and wire mesh guard cage.
 */
export const StandFanModel: React.FC<{
  dimensions: { length: number; width: number; height: number }
  explodedFactor?: number
  wireframe?: boolean
}> = ({ dimensions, explodedFactor = 0, wireframe = false }) => {
  const scale = 0.001
  const totalL = dimensions.length * scale
  const totalW = dimensions.width * scale
  const totalH = dimensions.height * scale

  // Guard diameter corresponds to fan width/length, height is total vertical height
  const guardRadius = Math.min(totalL, totalW) * 0.48
  const baseRadius = Math.min(totalL, totalW) * 0.45
  const baseHeight = 0.07 * (totalH / 1.25)
  const poleRadius = 0.02
  const poleHeight = Math.max(0.2, totalH - baseHeight - guardRadius * 2)

  // Exploded offsets
  const baseOffset = -explodedFactor * 0.15
  const poleOffset = explodedFactor * 0.05
  const headOffset = explodedFactor * 0.25
  const guardOffset = explodedFactor * 0.40
  const bladeOffset = explodedFactor * 0.48

  // Spokes for wire guard
  const spokes = useMemo(() => {
    return Array.from({ length: 16 }).map((_, i) => (i * Math.PI) / 8)
  }, [])

  return (
    <group position={[0, 0, 0]}>
      {/* 1. Base: Weighted Round Pedestal with beveled edge */}
      <group position={[0, baseOffset + baseHeight / 2, 0]}>
        <mesh receiveShadow castShadow>
          <cylinderGeometry args={[baseRadius * 0.92, baseRadius, baseHeight, 32]} />
          <meshStandardMaterial
            color="#27272a"
            roughness={0.4}
            metalness={0.2}
            wireframe={wireframe}
          />
        </mesh>
        {/* Base decorative ring */}
        <mesh position={[0, baseHeight / 2 + 0.002, 0]}>
          <ringGeometry args={[baseRadius * 0.3, baseRadius * 0.5, 32]} />
          <meshStandardMaterial color="#3f3f46" roughness={0.5} wireframe={wireframe} />
        </mesh>
      </group>

      {/* 2. Telescopic Pole with locking collar */}
      <group position={[0, poleOffset + baseHeight + poleHeight / 2, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[poleRadius, poleRadius * 1.1, poleHeight, 24]} />
          <meshStandardMaterial
            color="#d4d4d8"
            roughness={0.2}
            metalness={0.8}
            wireframe={wireframe}
          />
        </mesh>
        {/* Locking height collar */}
        <mesh position={[0, poleHeight * 0.2, 0]}>
          <cylinderGeometry args={[poleRadius * 1.35, poleRadius * 1.35, 0.035, 24]} />
          <meshStandardMaterial color="#18181b" roughness={0.3} wireframe={wireframe} />
        </mesh>
      </group>

      {/* 3. Motor & Gearbox Head Housing */}
      <group position={[0, headOffset + baseHeight + poleHeight + 0.05, 0]}>
        {/* Tilt pivot bracket */}
        <mesh position={[0, -0.04, 0]}>
          <boxGeometry args={[0.06, 0.05, 0.08]} />
          <meshStandardMaterial color="#27272a" roughness={0.4} wireframe={wireframe} />
        </mesh>
        {/* Motor cylindrical capsule */}
        <mesh position={[0, 0, -0.04]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.075, 0.085, 0.16, 24]} />
          <meshStandardMaterial
            color="#f4f4f5"
            roughness={0.3}
            metalness={0.1}
            wireframe={wireframe}
          />
        </mesh>
        {/* Oscillation knob on top */}
        <mesh position={[0, 0.085, -0.07]}>
          <cylinderGeometry args={[0.012, 0.012, 0.03, 16]} />
          <meshStandardMaterial color="#09090b" roughness={0.5} wireframe={wireframe} />
        </mesh>
      </group>

      {/* 4. Wire Mesh Guard & 4 Aerofoil Blades */}
      <group position={[0, guardOffset + baseHeight + poleHeight + 0.05, 0.06]}>
        {/* Rear Wire Guard Grille */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[guardRadius, 0.007, 16, 48]} />
          <meshStandardMaterial color="#71717a" roughness={0.3} metalness={0.6} wireframe={wireframe} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[guardRadius * 0.65, 0.005, 12, 36]} />
          <meshStandardMaterial color="#71717a" roughness={0.3} metalness={0.6} wireframe={wireframe} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[guardRadius * 0.35, 0.005, 12, 36]} />
          <meshStandardMaterial color="#71717a" roughness={0.3} metalness={0.6} wireframe={wireframe} />
        </mesh>

        {/* Radial Wire Spokes */}
        {spokes.map((angle, idx) => (
          <mesh key={idx} rotation={[0, 0, angle]}>
            <cylinderGeometry args={[0.002, 0.002, guardRadius * 2, 8]} />
            <meshStandardMaterial color="#a1a1aa" roughness={0.3} metalness={0.5} wireframe={wireframe} />
          </mesh>
        ))}

        {/* 4 Aerofoil Propeller Blades */}
        <group position={[0, 0, bladeOffset - guardOffset + 0.015]}>
          {/* Center Spinner Nut */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.04, 0.05, 24]} />
            <meshStandardMaterial color="#18181b" roughness={0.3} wireframe={wireframe} />
          </mesh>
          {/* 4 Blades spaced at 90 deg */}
          {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((bladeAngle, bIdx) => (
            <group key={bIdx} rotation={[0, 0, bladeAngle]}>
              <mesh position={[0, guardRadius * 0.48, 0]} rotation={[0.2, 0, -0.05]}>
                <boxGeometry args={[0.075, guardRadius * 0.8, 0.005]} />
                <meshStandardMaterial
                  color="#3b82f6"
                  roughness={0.25}
                  metalness={0.1}
                  transparent
                  opacity={0.88}
                  wireframe={wireframe}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* Front Wire Mesh Guard Clip Ring */}
        <mesh position={[0, 0, 0.035]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[guardRadius, 0.008, 16, 48]} />
          <meshStandardMaterial color="#d4d4d8" roughness={0.2} metalness={0.7} wireframe={wireframe} />
        </mesh>
        {/* Tornado / Toshiba Center Emblem badge */}
        <mesh position={[0, 0, 0.038]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.006, 32]} />
          <meshStandardMaterial color="#dc2626" roughness={0.3} wireframe={wireframe} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * High-fidelity Table Blender (e.g. Tornado BL500/2).
 * Composed of weighted motor base with dial, glass jug with handle, snug lid with cap.
 */
export const TableBlenderModel: React.FC<{
  dimensions: { length: number; width: number; height: number }
  explodedFactor?: number
  wireframe?: boolean
}> = ({ dimensions, explodedFactor = 0, wireframe = false }) => {
  const scale = 0.001
  const totalL = dimensions.length * scale
  const totalW = dimensions.width * scale
  const totalH = dimensions.height * scale

  const baseHeight = totalH * 0.42
  const jugHeight = totalH * 0.52
  const lidHeight = totalH * 0.06
  const baseR = Math.min(totalL, totalW) * 0.46
  const jugR = Math.min(totalL, totalW) * 0.40

  const baseOffset = -explodedFactor * 0.12
  const jugOffset = explodedFactor * 0.10
  const lidOffset = explodedFactor * 0.28

  return (
    <group>
      {/* 1. Motor Base with rotary speed dial */}
      <group position={[0, baseOffset + baseHeight / 2, 0]}>
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[baseR * 0.88, baseR, baseHeight, 32]} />
          <meshStandardMaterial
            color="#18181b"
            roughness={0.3}
            metalness={0.4}
            wireframe={wireframe}
          />
        </mesh>
        {/* Stainless trim ring */}
        <mesh position={[0, baseHeight * 0.2, 0]}>
          <cylinderGeometry args={[baseR * 0.91, baseR * 0.91, 0.03, 32]} />
          <meshStandardMaterial color="#e4e4e7" roughness={0.15} metalness={0.9} wireframe={wireframe} />
        </mesh>
        {/* Speed Selector Dial */}
        <mesh position={[0, 0, baseR * 0.92]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.015, 24]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.3} metalness={0.3} wireframe={wireframe} />
        </mesh>
      </group>

      {/* 2. Glass Blending Jug with Handle */}
      <group position={[0, jugOffset + baseHeight + jugHeight / 2, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[jugR, jugR * 0.78, jugHeight, 28]} />
          <meshStandardMaterial
            color="#93c5fd"
            roughness={0.1}
            metalness={0.1}
            transparent
            opacity={0.65}
            wireframe={wireframe}
          />
        </mesh>
        {/* Molded Ergonomic Handle */}
        <mesh position={[jugR * 1.15, 0, 0]}>
          <boxGeometry args={[0.025, jugHeight * 0.72, 0.025]} />
          <meshStandardMaterial color="#18181b" roughness={0.4} wireframe={wireframe} />
        </mesh>
        {/* Pouring Spout */}
        <mesh position={[0, jugHeight / 2 - 0.01, jugR * 0.95]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.035, 0.025, 0.02]} />
          <meshStandardMaterial color="#93c5fd" transparent opacity={0.65} wireframe={wireframe} />
        </mesh>
      </group>

      {/* 3. Snug Rubber Lid with Transparent Cap */}
      <group position={[0, lidOffset + baseHeight + jugHeight + lidHeight / 2, 0]}>
        <mesh>
          <cylinderGeometry args={[jugR * 1.04, jugR * 1.02, lidHeight, 28]} />
          <meshStandardMaterial color="#09090b" roughness={0.6} wireframe={wireframe} />
        </mesh>
        {/* Measuring Cap Insert */}
        <mesh position={[0, lidHeight, 0]}>
          <cylinderGeometry args={[jugR * 0.35, jugR * 0.35, 0.025, 20]} />
          <meshStandardMaterial color="#e0f2fe" transparent opacity={0.7} wireframe={wireframe} />
        </mesh>
      </group>
    </group>
  )
}

/**
 * High-fidelity Washing Machine (e.g. Toshiba VH-720).
 * Composed of appliance cabinet, circular front/top tub door, and top control console.
 */
export const WashingMachineModel: React.FC<{
  dimensions: { length: number; width: number; height: number }
  wireframe?: boolean
}> = ({ dimensions, wireframe = false }) => {
  const scale = 0.001
  const l = dimensions.length * scale
  const w = dimensions.width * scale
  const h = dimensions.height * scale

  return (
    <group position={[0, h / 2, 0]}>
      {/* Cabinet Body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[l, h, w]} />
        <meshStandardMaterial color="#f4f4f5" roughness={0.3} metalness={0.15} wireframe={wireframe} />
      </mesh>
      {/* Front Circular Porthole Door with Chrome Trim */}
      <mesh position={[0, -h * 0.05, w / 2 + 0.005]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(l, h) * 0.32, Math.min(l, h) * 0.32, 0.018, 36]} />
        <meshStandardMaterial color="#27272a" roughness={0.2} metalness={0.7} wireframe={wireframe} />
      </mesh>
      {/* Glass window */}
      <mesh position={[0, -h * 0.05, w / 2 + 0.015]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[Math.min(l, h) * 0.24, Math.min(l, h) * 0.24, 0.005, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.1} transparent opacity={0.75} wireframe={wireframe} />
      </mesh>
      {/* Top Angled Control Console */}
      <mesh position={[0, h / 2 - 0.04, w / 2 - 0.03]} rotation={[-0.2, 0, 0]}>
        <boxGeometry args={[l * 0.94, 0.07, 0.06]} />
        <meshStandardMaterial color="#18181b" roughness={0.3} wireframe={wireframe} />
      </mesh>
    </group>
  )
}

/**
 * Flat Screen TV / Smart Display (e.g. Sharp 43ES9500E).
 */
export const TVModel: React.FC<{
  dimensions: { length: number; width: number; height: number }
  wireframe?: boolean
}> = ({ dimensions, wireframe = false }) => {
  const scale = 0.001
  const l = dimensions.length * scale
  const w = dimensions.width * scale
  const h = dimensions.height * scale

  return (
    <group position={[0, h / 2 + 0.04, 0]}>
      {/* Ultra-slim screen with thin bezel */}
      <mesh castShadow>
        <boxGeometry args={[l, h, Math.max(0.015, w * 0.2)]} />
        <meshStandardMaterial color="#09090b" roughness={0.2} metalness={0.4} wireframe={wireframe} />
      </mesh>
      {/* Active Glass Panel */}
      <mesh position={[0, 0, Math.max(0.015, w * 0.2) / 2 + 0.002]}>
        <planeGeometry args={[l * 0.98, h * 0.96]} />
        <meshStandardMaterial color="#18181b" roughness={0.05} metalness={0.8} wireframe={wireframe} />
      </mesh>
      {/* Dual Feet Stand */}
      <mesh position={[-l * 0.35, -h / 2 - 0.02, 0]} castShadow>
        <boxGeometry args={[0.025, 0.04, 0.16]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.3} metalness={0.7} wireframe={wireframe} />
      </mesh>
      <mesh position={[l * 0.35, -h / 2 - 0.02, 0]} castShadow>
        <boxGeometry args={[0.025, 0.04, 0.16]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.3} metalness={0.7} wireframe={wireframe} />
      </mesh>
    </group>
  )
}

/**
 * Generic Rounded Consumer Appliance.
 */
export const GenericApplianceModel: React.FC<{
  dimensions: { length: number; width: number; height: number }
  wireframe?: boolean
}> = ({ dimensions, wireframe = false }) => {
  const scale = 0.001
  const l = dimensions.length * scale
  const w = dimensions.width * scale
  const h = dimensions.height * scale

  return (
    <group position={[0, h / 2, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[l, h, w]} />
        <meshStandardMaterial color="#e4e4e7" roughness={0.35} metalness={0.2} wireframe={wireframe} />
      </mesh>
      {/* Front Faceplate Accent */}
      <mesh position={[0, 0, w / 2 + 0.002]}>
        <planeGeometry args={[l * 0.88, h * 0.85]} />
        <meshStandardMaterial color="#27272a" roughness={0.4} metalness={0.3} wireframe={wireframe} />
      </mesh>
    </group>
  )
}

/**
 * Disassembled Packed Parts Mode.
 * Renders individual components arranged horizontally inside the packaging footprint.
 */
export const PackedPartsModel: React.FC<{
  components?: ComponentSpec[]
  onSelectComponent?: (comp: ComponentSpec) => void
  selectedComponentName?: string | null
  wireframe?: boolean
}> = ({ components = [], onSelectComponent, selectedComponentName, wireframe = false }) => {
  const scale = 0.001

  // Standard component palette
  const partColors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4']

  return (
    <group position={[0, 0.02, 0]}>
      {components.map((comp, idx) => {
        const cL = comp.length_mm * scale
        const cW = comp.width_mm * scale
        const cH = comp.height_mm * scale

        // Compute 2D grid placement
        const row = Math.floor(idx / 3)
        const col = idx % 3
        const posX = (col - 1) * 0.22
        const posZ = (row - 0.5) * 0.22
        const isSelected = selectedComponentName === comp.name

        return (
          <group
            key={comp.name || idx}
            position={[posX, cH / 2, posZ]}
            onClick={(e) => {
              e.stopPropagation()
              onSelectComponent?.(comp)
            }}
          >
            <mesh castShadow>
              <boxGeometry args={[cL * 0.7, cH, cW * 0.7]} />
              <meshStandardMaterial
                color={partColors[idx % partColors.length]}
                roughness={0.4}
                metalness={0.2}
                emissive={isSelected ? '#3b82f6' : '#000000'}
                emissiveIntensity={isSelected ? 0.4 : 0}
                wireframe={wireframe}
              />
            </mesh>
            {/* HTML Tooltip on hover/select */}
            <Html position={[0, cH / 2 + 0.03, 0]} center style={{ pointerEvents: 'none' }}>
              <div
                style={{
                  background: isSelected ? 'rgba(30, 58, 138, 0.95)' : 'rgba(15, 23, 42, 0.85)',
                  color: '#ffffff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  fontSize: '9px',
                  fontFamily: 'monospace',
                  whiteSpace: 'nowrap',
                  border: isSelected ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.1)',
                }}
              >
                {comp.name} ({comp.length_mm}×{comp.width_mm}×{comp.height_mm} mm · {comp.weight_kg} kg)
              </div>
            </Html>
          </group>
        )
      })}
    </group>
  )
}

/**
 * Master Parametric Product Component:
 * Chooses the appropriate parametric model based on category or product name,
 * scales it to real millimeter dimensions, and handles Assembled, Packed Parts, and Exploded modes.
 */
export const ParametricProduct3D: React.FC<ParametricProductProps> = ({
  category,
  productName,
  dimensions,
  viewMode,
  explodedFactor = 0,
  wireframe = false,
  components = [],
  onSelectComponent,
  selectedComponentName,
}) => {
  const norm = `${category || ''} ${productName || ''}`.toLowerCase()

  if (viewMode === 'packed_parts') {
    return (
      <PackedPartsModel
        components={components}
        onSelectComponent={onSelectComponent}
        selectedComponentName={selectedComponentName}
        wireframe={wireframe}
      />
    )
  }

  if (norm.includes('fan') || norm.includes('tsf') || norm.includes('efs')) {
    return (
      <StandFanModel
        dimensions={dimensions}
        explodedFactor={explodedFactor}
        wireframe={wireframe}
      />
    )
  }

  if (norm.includes('blender') || norm.includes('bl500') || norm.includes('mx')) {
    return (
      <TableBlenderModel
        dimensions={dimensions}
        explodedFactor={explodedFactor}
        wireframe={wireframe}
      />
    )
  }

  if (norm.includes('wash') || norm.includes('vh')) {
    return (
      <WashingMachineModel
        dimensions={dimensions}
        wireframe={wireframe}
      />
    )
  }

  if (norm.includes('tv') || norm.includes('screen') || norm.includes('led')) {
    return (
      <TVModel
        dimensions={dimensions}
        wireframe={wireframe}
      />
    )
  }

  return (
    <GenericApplianceModel
      dimensions={dimensions}
      wireframe={wireframe}
    />
  )
}
