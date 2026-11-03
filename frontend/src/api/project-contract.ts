import { z } from 'zod'
import { PRODUCT_TYPES } from './product-types'

const provenanceSchema = z.object({
  source_name: z.string(), source_url: z.string().nullish(), retrieval_date: z.string().nullish(),
  source_type: z.enum(['EL_ARABY_DATASHEET', 'EL_ARABY_WEBSITE', 'PUBLIC_RETAIL', 'USER_ENTERED', 'CAD_EXTRACTED', 'AI_ESTIMATED', 'FROM_DESCRIPTION', 'DERIVED', 'OFFICIAL_COMPANY']),
  confidence: z.number().min(0).max(1).nullish(), is_edited: z.boolean().default(false), evidence_snippet: z.string().nullish(),
})
const fragilitySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'])
const componentSchema = z.object({
  name: z.string().min(1).max(100), length_mm: z.number().gt(0).max(10000).nullish(), width_mm: z.number().gt(0).max(10000).nullish(),
  height_mm: z.number().gt(0).max(10000).nullish(), weight_kg: z.number().gt(0).max(1000).nullish(), quantity: z.number().int().min(1).default(1),
  fragility: fragilitySchema.nullish(), notes: z.string().max(500).nullish(), provenance: provenanceSchema.nullish(),
})
const dimensionSchema = z.object({ length: z.number().gt(0).max(10000), width: z.number().gt(0).max(10000), height: z.number().gt(0).max(10000), unit: z.enum(['mm', 'cm', 'm', 'inch']) })
const productSchema = z.object({
  name: z.string().min(1).max(200), brand: z.string().min(1).max(100), model: z.string().max(100).nullish(), sku: z.string().max(100).nullish(), category: z.string().max(100).nullish(),
  product_type: z.enum(PRODUCT_TYPES), product_type_provenance: provenanceSchema.nullish(), shipping_mode: z.enum(['courier_parcel', 'ltl_pallet', 'full_truck', 'container', 'ecommerce_marketplace']).nullish(),
  weight_kg: z.number().gt(0).max(5000), fragility_class: fragilitySchema, fragility_note: z.string().max(500).nullish(), packed_dimensions: dimensionSchema,
  components: z.array(componentSchema).optional(), image_url: z.string().max(1000).nullish(), images: z.array(z.string()).optional(), provenance: provenanceSchema.nullish(), notes: z.string().max(1000).nullish(),
})
const baselineSchema = z.object({
  carton_outer_length_mm: z.number().gt(0).max(10000), carton_outer_width_mm: z.number().gt(0).max(10000), carton_outer_height_mm: z.number().gt(0).max(10000),
  board_type: z.string().min(1).max(100), board_thickness_mm: z.number().min(1, 'Enter a board thickness from 1 to 15 mm.').max(15, 'Enter a board thickness from 1 to 15 mm.'), carton_cost_per_unit: z.number().min(0),
  currency: z.string().max(10).default('EGP'), units_per_pallet: z.number().int().min(1).max(10000).optional(), pallet_type: z.string().max(100).default('Euro Pallet 1200x800'), notes: z.string().max(500).nullish(), provenance: provenanceSchema.nullish(),
})
const optimizationSchema = z.object({ min_clearance_mm: z.number().min(0).max(200).default(15), standard_clearance_mm: z.number().min(0).max(200).default(25), generous_clearance_mm: z.number().min(0).max(200).default(40), board_thickness_mm: z.number().min(1).max(20).default(4), insert_thickness_mm: z.number().min(0).max(100).default(20), assumption_label: z.string().default('ENGINEERING_ASSUMPTION') })

export const projectCreateSchema = z.object({
  name: z.string().min(1).max(200), description: z.string().max(1000).nullish(), product: productSchema, baseline: baselineSchema,
  planned: z.object({ carton_outer_length_mm: z.number().gt(0).max(10000), carton_outer_width_mm: z.number().gt(0).max(10000), carton_outer_height_mm: z.number().gt(0).max(10000), board_thickness_mm: z.number().gt(0).max(50).default(4), notes: z.string().max(500).nullish(), provenance: provenanceSchema.nullish() }).nullish(),
  components: z.array(componentSchema).optional(), optimization_config: optimizationSchema.prefault({}), language: z.enum(['en', 'ar']).default('en'),
}).superRefine((project, context) => {
  const parts = project.components?.length ? project.components : project.product.components ?? []
  const box = [project.baseline.carton_outer_length_mm, project.baseline.carton_outer_width_mm, project.baseline.carton_outer_height_mm]
  if (parts.length > 0) {
    const diagonal = Math.hypot(...box)
    const smallest = Math.min(...box)
    const volume = box.reduce((a, b) => a * b, 1)
    for (const [index, part] of parts.entries()) {
      if (part.length_mm == null || part.width_mm == null || part.height_mm == null) continue
      const dims = [part.length_mm, part.width_mm, part.height_mm]
      if (Math.max(...dims) > diagonal || Math.min(...dims) > smallest || dims.reduce((a, b) => a * b, 1) > volume) {
        context.addIssue({ code: 'custom', path: ['components', index], message: 'Component dimensions do not fit the carton.' })
      }
    }
    return
  }
  const factor = { mm: 1, cm: 10, m: 1000, inch: 25.4 }[project.product.packed_dimensions.unit]
  const product = [project.product.packed_dimensions.length, project.product.packed_dimensions.width, project.product.packed_dimensions.height].map((n) => n * factor).sort((a, b) => a - b)
  const carton = [...box].sort((a, b) => a - b)
  if (product.some((dimension, index) => dimension > carton[index])) context.addIssue({ code: 'custom', path: ['baseline', 'carton_outer_length_mm'], message: 'Carton is smaller than the product.' })
})

export type ProjectCreateInput = z.input<typeof projectCreateSchema>
export const parseProjectCreate = (payload: unknown) => projectCreateSchema.safeParse(payload)
