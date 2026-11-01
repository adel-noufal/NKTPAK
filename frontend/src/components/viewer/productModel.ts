import type { ProductType } from '../../types'

export interface ProductModelProject {
  product_type?: ProductType | null
  provenance?: { source_type?: string } | null
  geometry_source?: 'CAD' | 'photos' | null
}

export interface ProductModelResolution {
  model: 'blender' | 'stand_fan' | 'generic'
  label: string
}

const labels: Record<ProductType, string> = {
  blender: 'blender',
  stand_fan: 'stand fan',
  ceiling_fan: 'ceiling fan',
  washing_machine: 'washing machine',
  refrigerator: 'refrigerator',
  air_conditioner: 'air conditioner',
  tv: 'TV',
  kettle: 'kettle',
  microwave: 'microwave',
  water_heater: 'water heater',
  other: 'product',
}

export function inferProductType(text: string): ProductType | null {
  const normalized = text.toLocaleLowerCase()
  const mapping: Array<[ProductType, string[]]> = [
    ['ceiling_fan', ['ceiling fan']],
    ['stand_fan', ['stand fan', 'pedestal fan', 'tsf-', ' fan']],
    ['blender', ['blender', 'bl500', 'mx5200']],
    ['washing_machine', ['washing machine', 'washer', 'vh-720']],
    ['refrigerator', ['refrigerator', 'fridge']],
    ['air_conditioner', ['air conditioner', 'split ac']],
    ['tv', ['television', 'smart tv', ' led tv']],
    ['kettle', ['kettle']],
    ['microwave', ['microwave']],
    ['water_heater', ['water heater']],
  ]
  return mapping.find(([, terms]) => terms.some((term) => normalized.includes(term)))?.[0] ?? null
}

/** Single authority for model choice and its visible geometry provenance label. */
export function resolveProductModel(project: ProductModelProject): ProductModelResolution {
  if (project.geometry_source === 'CAD' || project.provenance?.source_type === 'CAD_EXTRACTED') {
    return { model: 'generic', label: 'CAD geometry bounds (mesh unavailable)' }
  }
  if (project.geometry_source === 'photos') {
    return { model: 'generic', label: 'Reconstructed from photos' }
  }
  const type = project.product_type
  if (type === 'blender') return { model: 'blender', label: 'Approximate model for blender' }
  if (type === 'stand_fan') return { model: 'stand_fan', label: 'Approximate model for stand fan' }
  if (!type || type === 'other') return { model: 'generic', label: 'Generic shape — choose the product type' }
  return { model: 'generic', label: `Generic shape for ${labels[type]}` }
}
