import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { boxSizeLWH, cameraFitDistance, createBoxGeometryLWH, fitObjectToBounds, measureClearance } from '../components/viewer/sceneGeometry'
import { resolveProductModel } from '../components/viewer/productModel'
import { PRODUCT_TYPES, type ProductType } from '../types'

const product = { length: 180, width: 165, height: 390 }
const candidates = [
  { length: 312, width: 297, height: 522, board: 4 },
  { length: 240, width: 225, height: 450, board: 4 },
]
const viewModes = ['box', 'inside', 'product', 'exploded', 'packed_parts']

describe('millimetre scene convention and measured product placement', () => {
  it('fits a perspective camera from the measured bounding sphere and FOV', () => {
    const carton = { length: 878, width: 328, height: 478 }
    const radius = Math.hypot(carton.length / 2, carton.width / 2, carton.height / 2)
    const expected = (radius / Math.sin(THREE.MathUtils.degToRad(45) / 2)) * 1.3
    expect(cameraFitDistance(radius, 45)).toBeCloseTo(expected, 8)
    expect(() => cameraFitDistance(0, 45)).toThrow()
  })

  it.each(PRODUCT_TYPES)('%s stays inside every candidate carton for every view', (productType: ProductType) => {
    const model = resolveProductModel({ product_type: productType })
    expect(model.model).toBe(productType === 'blender' ? 'blender' : productType === 'stand_fan' ? 'stand_fan' : 'generic')

    for (const candidate of candidates) {
      const cartonSize = new THREE.Vector3(candidate.length, candidate.height, candidate.width)
      const innerSize = new THREE.Vector3(
        candidate.length - candidate.board * 2,
        candidate.height - candidate.board * 2,
        candidate.width - candidate.board * 2,
      )
      const targetProductSize = new THREE.Vector3(product.length, product.height, product.width)
      for (const view of viewModes) {
        const carton = new THREE.Mesh(createBoxGeometryLWH(candidate), new THREE.MeshBasicMaterial())
        const productObject = new THREE.Group()
        // Recreate the old base-pivot mismatch: the geometry starts at Y=0.
        const basePivot = new THREE.Group()
        basePivot.position.y = product.height / 2
        basePivot.add(new THREE.Mesh(createBoxGeometryLWH(product), new THREE.MeshBasicMaterial()))
        productObject.scale.setScalar(1)
        productObject.add(basePivot)
        const inner = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(), innerSize)
        const cartonBox = new THREE.Box3().setFromObject(carton)
        const productBox = fitObjectToBounds(productObject, targetProductSize, inner.getCenter(new THREE.Vector3()))
        const clearance = measureClearance(inner, productBox)

        expect(boxSizeLWH(cartonBox)).toEqual({ length: candidate.length, width: candidate.width, height: candidate.height })
        expect(boxSizeLWH(productBox)).toEqual(product)
        expect(productBox.min.x).toBeGreaterThan(inner.min.x)
        expect(productBox.max.x).toBeLessThan(inner.max.x)
        expect(productBox.min.y).toBeGreaterThan(inner.min.y)
        expect(productBox.max.y).toBeLessThan(inner.max.y)
        expect(productBox.min.z).toBeGreaterThan(inner.min.z)
        expect(productBox.max.z).toBeLessThan(inner.max.z)
        for (const sideGaps of [clearance.length, clearance.width, clearance.height]) {
          expect(sideGaps[0]).toBeGreaterThanOrEqual(15)
          expect(sideGaps[1]).toBeGreaterThanOrEqual(15)
        }
        if (view === 'exploded') {
          const insideBox = fitObjectToBounds(productObject.clone(), targetProductSize, inner.getCenter(new THREE.Vector3()))
          expect(productBox.min.toArray()).toEqual(insideBox.min.toArray())
          expect(productBox.max.toArray()).toEqual(insideBox.max.toArray())
        }
      }
    }
  })

  it('uses a neutral generic shape for unknown types', () => {
    expect(resolveProductModel({}).label).toBe('Estimated geometry')
    expect(resolveProductModel({ product_type: 'other' }).model).toBe('generic')
  })
})
