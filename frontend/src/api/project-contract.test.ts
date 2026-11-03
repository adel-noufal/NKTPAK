import { describe, expect, it } from 'vitest'
import { parseProjectCreate } from './project-contract'

const formPayload = {
  name: 'Tornado Blender BL500/2', language: 'en', components: [],
  product: {
    name: 'Tornado Blender BL500/2', brand: 'Tornado', model: 'BL500/2', product_type: 'blender',
    product_type_provenance: { source_name: 'From your description', source_type: 'FROM_DESCRIPTION' },
    weight_kg: 3.2, fragility_class: 'MEDIUM',
    packed_dimensions: { length: 180, width: 165, height: 390, unit: 'mm' }, components: [], images: [],
    provenance: { source_name: 'From your description', source_type: 'FROM_DESCRIPTION' },
  },
  baseline: {
    carton_outer_length_mm: 240, carton_outer_width_mm: 225, carton_outer_height_mm: 450,
    board_type: 'BC Double Wall', board_thickness_mm: 5, carton_cost_per_unit: 22.5,
    currency: 'EGP', units_per_pallet: 16, pallet_type: 'Euro Pallet 1200x800',
    provenance: { source_name: 'From your description', source_type: 'FROM_DESCRIPTION' },
  },
  optimization_config: { min_clearance_mm: 15, standard_clearance_mm: 25, generous_clearance_mm: 40 },
}

describe('New Project API contract validation', () => {
  it('accepts the complete free-text blender payload and source type', () => {
    const result = parseProjectCreate(formPayload)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.product.product_type).toBe('blender')
      expect(result.data.product.provenance?.source_type).toBe('FROM_DESCRIPTION')
      expect(result.data.optimization_config?.board_thickness_mm).toBe(4)
    }
  })

  it('rejects empty strings instead of treating them as valid numbers', () => {
    const result = parseProjectCreate({ ...formPayload, baseline: { ...formPayload.baseline, carton_cost_per_unit: '' } })
    expect(result.success).toBe(false)
  })

  it('accepts a project when the model number is not known', () => {
    const product = { ...formPayload.product }
    delete (product as { model?: string }).model
    expect(parseProjectCreate({ ...formPayload, product }).success).toBe(true)
  })
})
