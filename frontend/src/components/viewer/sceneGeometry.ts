import * as THREE from 'three'

export interface LWH { length: number; width: number; height: number }

/** Three.js uses X,Y,Z; map package L,W,H to scene X=length, Y=height, Z=width. */
export function vectorFromLWH(value: LWH): THREE.Vector3 {
  return new THREE.Vector3(value.length, value.height, value.width)
}

export function createBoxGeometryLWH(value: LWH): THREE.BoxGeometry {
  const size = vectorFromLWH(value)
  return new THREE.BoxGeometry(size.x, size.y, size.z)
}

/** Fit the real world-space bounds and center them on the requested scene point. */
export function fitObjectToBounds(
  object: THREE.Object3D,
  targetSize: THREE.Vector3,
  targetCenter = new THREE.Vector3(),
): THREE.Box3 {
  object.updateWorldMatrix(true, true)
  const initial = new THREE.Box3().setFromObject(object)
  const size = initial.getSize(new THREE.Vector3())
  if (size.x <= 0 || size.y <= 0 || size.z <= 0) {
    throw new Error(`Cannot fit an empty 3D object: ${size.toArray().join(',')}`)
  }
  object.scale.multiply(new THREE.Vector3(targetSize.x / size.x, targetSize.y / size.y, targetSize.z / size.z))
  object.updateWorldMatrix(true, true)
  const box = new THREE.Box3().setFromObject(object)
  const centre = box.getCenter(new THREE.Vector3())
  object.position.add(targetCenter.clone().sub(centre))
  object.updateWorldMatrix(true, true)
  return new THREE.Box3().setFromObject(object)
}

export function measureClearance(inner: THREE.Box3, product: THREE.Box3) {
  return {
    length: [product.min.x - inner.min.x, inner.max.x - product.max.x] as const,
    height: [product.min.y - inner.min.y, inner.max.y - product.max.y] as const,
    width: [product.min.z - inner.min.z, inner.max.z - product.max.z] as const,
  }
}

export function boxSizeLWH(box: THREE.Box3): LWH {
  const size = box.getSize(new THREE.Vector3())
  return { length: size.x, width: size.z, height: size.y }
}
