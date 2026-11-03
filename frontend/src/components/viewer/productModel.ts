import type { ProductType } from '../../types'

export interface ProductModelProject {
  product_type?: ProductType | null
  provenance?: { source_type?: string } | null
  geometry_source?: 'CAD' | 'photos' | null
}

export interface ProductModelResolution {
  model: 'blender' | 'stand_fan' | 'generic'
  label: string
  tooltip: string
  isApproximate: boolean
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
    return { model: 'generic', label: 'Estimated geometry', tooltip: 'A shape is shown from the available CAD dimensions.', isApproximate: true }
  }
  if (project.geometry_source === 'photos') {
    return { model: 'generic', label: 'Estimated geometry', tooltip: 'A simplified shape is shown from photo references.', isApproximate: true }
  }
  const type = project.product_type
  if (type === 'blender') return { model: 'blender', label: 'Estimated geometry', tooltip: 'Simplified blender geometry based on the entered dimensions.', isApproximate: true }
  if (type === 'stand_fan') return { model: 'stand_fan', label: 'Estimated geometry', tooltip: 'Simplified stand fan geometry based on the entered dimensions.', isApproximate: true }
  if (!type || type === 'other') return { model: 'generic', label: 'Estimated geometry', tooltip: 'Generic shape based on the entered dimensions.', isApproximate: true }
  return { model: 'generic', label: 'Estimated geometry', tooltip: `Generic shape based on the entered dimensions for ${labels[type]}.`, isApproximate: true }
}
