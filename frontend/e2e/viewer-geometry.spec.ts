import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

type ProductType = 'blender' | 'stand_fan'
type DebugBox = { min: { x: number; y: number; z: number }; max: { x: number; y: number; z: number }; size: { length: number; width: number; height: number } }
type SceneDebug = {
  view: string
  candidateId: string
  productType: ProductType
  resolvedModel: { model: string; label: string }
  sceneObjectNames: string[]
  productObjectName: string
  separation: number
  cartonBox: DebugBox
  innerCartonBox: DebugBox
  productBox: DebugBox
  clearanceMm: { length: number[]; width: number[]; height: number[] }
}

const productDims = { length: 180, width: 165, height: 390 }
const candidates = [
  { alternative_id: 'candidate-312', name: 'Candidate 312', outer_length_mm: 312, outer_width_mm: 297, outer_height_mm: 522 },
  { alternative_id: 'candidate-240', name: 'Candidate 240', outer_length_mm: 240, outer_width_mm: 225, outer_height_mm: 450 },
]
const dimsByCandidate = new Map(candidates.map((candidate) => [candidate.alternative_id, candidate]))

function makeAlternative(candidate: typeof candidates[number], recommended = false) {
  return {
    ...candidate,
    description: 'Playwright geometry test candidate',
    rank: recommended ? 'RECOMMENDED' : 'ALTERNATIVE',
    board_thickness_mm: 4,
    inner_length_mm: candidate.outer_length_mm - 8,
    inner_width_mm: candidate.outer_width_mm - 8,
    inner_height_mm: candidate.outer_height_mm - 8,
    clearance_length_mm: 15,
    clearance_width_mm: 15,
    clearance_height_mm: 15,
    insert_thickness_mm: 0,
    insert_description: 'No insert',
    savings: { volume_utilization_pct: 50, material_saved_pct: 1, savings_status: 'CALCULATED' },
    material_usage: { total_material_volume_cm3: 1 },
    cost: { total_cost: 1, currency: 'EGP' },
    mckee_compression: {},
    palletization: {},
    ranking_score: 1,
    ranking_criteria: {},
    assumptions: [],
  }
}

function makeProject(productType: ProductType) {
  const alternatives = candidates.map((candidate, index) => makeAlternative(candidate, index === 0))
  const components = [
    { name: 'TEST lower assembly', length_mm: 120, width_mm: 100, height_mm: 160, weight_kg: 1, quantity: 1 },
    { name: 'TEST upper assembly', length_mm: 100, width_mm: 90, height_mm: 170, weight_kg: 1, quantity: 1 },
  ]
  return {
    project_id: `test-${productType}`,
    short_id: `test-${productType}`,
    name: productType === 'blender' ? 'TEST Blender Geometry' : 'TEST Stand Fan Geometry',
    brand: 'TEST ONLY',
    model_number: productType === 'blender' ? 'TEST-BLENDER' : 'TEST-FAN',
    status: 'completed',
    language: 'en',
    product_data: {
      name: productType === 'blender' ? 'TEST table blender' : 'TEST stand fan',
      product_type: productType,
      product_type_provenance: { source_name: 'Playwright test input', source_type: 'USER_ENTERED' },
      fragility_class: 'LOW',
      packed_dimensions: { ...productDims, unit: 'mm' },
      components,
      provenance: { source_type: 'USER_ENTERED' },
    },
    components_data: components,
    baseline_data: {
      carton_outer_length_mm: 312, carton_outer_width_mm: 297, carton_outer_height_mm: 522,
      board_type: 'TEST', board_thickness_mm: 4, carton_cost_per_unit: 1, currency: 'EGP', units_per_pallet: 1, pallet_type: 'TEST',
    },
    optimization_config: { min_clearance_mm: 15, standard_clearance_mm: 25, generous_clearance_mm: 40 },
    optimization_result: { alternatives, recommended: alternatives[0], result_warning: 'Playwright geometry test data' },
    standards_result: null,
  }
}

async function readScene(page: Page, productType: ProductType, candidateId: string, view: string): Promise<SceneDebug> {
  try {
    await page.waitForFunction(({ expectedType, expectedCandidate, expectedView }) => {
    const debug = (window as any).__NEXTPAK_3D_DEBUG__
    return debug?.productBox && debug?.cartonBox && debug?.innerCartonBox && debug?.productObjectName &&
      debug.productType === expectedType && debug.candidateId === expectedCandidate && debug.view === expectedView
    }, { expectedType: productType, expectedCandidate: candidateId, expectedView: view }, { timeout: 5_000 })
  } catch {
    const actual = await page.evaluate(() => (window as any).__NEXTPAK_3D_DEBUG__)
    throw new Error(`Scene debug mismatch: expected ${JSON.stringify({ productType, candidateId, view })}, received ${JSON.stringify(actual)}`)
  }
  return page.evaluate(() => (window as any).__NEXTPAK_3D_DEBUG__ as SceneDebug)
}

function expectBoxSize(actual: DebugBox['size'], expected: typeof productDims) {
  expect(Math.abs(actual.length - expected.length)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(actual.width - expected.width)).toBeLessThanOrEqual(0.5)
  expect(Math.abs(actual.height - expected.height)).toBeLessThanOrEqual(0.5)
}

function assertGeometry(scene: SceneDebug, productType: ProductType, candidateId: string) {
  const candidate = dimsByCandidate.get(candidateId)!
  expect(scene.productType).toBe(productType)
  expect(scene.resolvedModel.model).toBe(productType)
  const label = productType === 'stand_fan' ? 'stand fan' : 'blender'
  expect(scene.resolvedModel.label).toBe(`Approximate model for ${label}`)
  expect(scene.productObjectName).toBe(`product-model-${productType}`)
  expect(scene.sceneObjectNames).toContain(`product-model-${productType}`)
  expectBoxSize(scene.cartonBox.size, { length: candidate.outer_length_mm, width: candidate.outer_width_mm, height: candidate.outer_height_mm })
  expectBoxSize(scene.productBox.size, productDims)

  for (const axis of ['x', 'y', 'z'] as const) {
    expect(scene.productBox.min[axis]).toBeGreaterThan(scene.innerCartonBox.min[axis])
    expect(scene.productBox.max[axis]).toBeLessThan(scene.innerCartonBox.max[axis])
    const centerProduct = (scene.productBox.min[axis] + scene.productBox.max[axis]) / 2
    const centerInner = (scene.innerCartonBox.min[axis] + scene.innerCartonBox.max[axis]) / 2
    expect(Math.abs(centerProduct - centerInner)).toBeLessThanOrEqual(0.5)
  }
  for (const sideGaps of [scene.clearanceMm.length, scene.clearanceMm.width, scene.clearanceMm.height]) {
    expect(sideGaps).toHaveLength(2)
    expect(sideGaps[0]).toBeGreaterThanOrEqual(15)
    expect(sideGaps[1]).toBeGreaterThanOrEqual(15)
  }
}

for (const productType of ['blender', 'stand_fan'] as const) {
  test(`${productType} geometry remains bounded for every view and candidate`, async ({ page }) => {
    test.setTimeout(60_000)
    const project = makeProject(productType)
    await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'healthy' } }))
    await page.route(`**/api/v1/projects/${project.project_id}`, (route) => route.fulfill({ json: project }))
    await page.goto(`/projects/${project.project_id}`)

    await expect(page.getByRole('button', { name: 'Inside the Box' })).toBeVisible()
    const views = [
      { label: 'Box (Outside)', debug: 'box' },
      { label: 'Inside the Box', debug: 'inside' },
      { label: 'Product Alone', debug: 'product' },
      { label: 'Exploded View', debug: 'exploded' },
      { label: 'Packed Parts', debug: 'packed_parts' },
    ]
    const screenshotRoot = path.resolve(process.cwd(), '../test-evidence/viewer', productType)
    await mkdir(screenshotRoot, { recursive: true })

    let insideAtZero: SceneDebug | null = null
    for (const candidate of candidates) {
      if (candidate.alternative_id !== candidates[0].alternative_id) {
        await page.getByText(candidate.name, { exact: true }).click()
      }
      for (const view of views) {
        if (view.debug === 'packed_parts') {
          await page.getByRole('button', { name: 'Product Alone' }).click()
          await page.getByRole('button', { name: 'Packed Parts' }).click()
        } else if (view.debug === 'product') {
          await page.getByRole('button', { name: 'Product Alone' }).click()
          await page.getByRole('button', { name: 'Assembled' }).click()
        } else {
          await page.getByRole('button', { name: view.label }).click()
        }
        if (view.debug === 'exploded') {
          const separation = page.getByRole('slider')
          await separation.evaluate((element) => {
            const input = element as HTMLInputElement
            input.value = '0'
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          })
          await expect(page.getByText('0%', { exact: true })).toBeVisible()
        }
        const scene = await readScene(page, productType, candidate.alternative_id, view.debug)
        assertGeometry(scene, productType, candidate.alternative_id)
        const cartonLabel = await page.getByTestId('carton-dimensions').innerText()
        const productLabel = await page.getByTestId('product-dimensions').innerText()
        expect(cartonLabel).toContain(`${scene.cartonBox.size.length.toFixed(1)} × ${scene.cartonBox.size.width.toFixed(1)} × ${scene.cartonBox.size.height.toFixed(1)} mm`)
        expect(productLabel).toContain(`${scene.productBox.size.length.toFixed(1)} × ${scene.productBox.size.width.toFixed(1)} × ${scene.productBox.size.height.toFixed(1)} mm`)
        const clearanceLabel = await page.getByTestId('clearance-dimensions').innerText()
        const fixed = (values: number[]) => values.map((value) => value.toFixed(1)).join(' / ')
        expect(clearanceLabel).toBe(`L: ${fixed(scene.clearanceMm.length)} · W: ${fixed(scene.clearanceMm.width)} · H: ${fixed(scene.clearanceMm.height)} mm`)
        await expect(page.getByTestId('clearance-target-status')).toHaveText('Clearance target met')

        if (candidate === candidates[0] && view.debug === 'inside') insideAtZero = scene
        if (candidate === candidates[0] && view.debug === 'exploded') {
          expect(scene.separation).toBe(0)
          expect(scene.productBox.min).toEqual(insideAtZero!.productBox.min)
          expect(scene.productBox.max).toEqual(insideAtZero!.productBox.max)
        }
        if (candidate === candidates[0]) {
          const filename = view.debug === 'packed_parts' ? 'packed-parts' : view.debug
          await page.screenshot({ path: path.join(screenshotRoot, `${filename}.png`), fullPage: true })
        }
      }
    }
    await expect(page.getByTestId('geometry-source')).toContainText(`Approximate model for ${productType === 'stand_fan' ? 'stand fan' : 'blender'}`)
  })
}

test('missing product dimensions show an editor action and never report clearance as met', async ({ page }) => {
  const project = makeProject('blender')
  delete (project.product_data as any).packed_dimensions
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'healthy' } }))
  await page.route(`**/api/v1/projects/${project.project_id}`, (route) => route.fulfill({ json: project }))
  await page.goto(`/projects/${project.project_id}`)
  await expect(page.getByTestId('missing-dimensions-message')).toHaveText('Product dimensions are missing — enter them')
  await expect(page.getByText('Clearance target met')).toHaveCount(0)
  await page.getByRole('button', { name: 'Edit product dimensions' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(page.getByLabel('Length (mm)')).toHaveValue('')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await page.screenshot({ path: path.resolve(process.cwd(), '../test-evidence/missing-product-dimensions.png'), fullPage: true })
})

test('standards page displays ISO and ISTA entries and supports organisation filters', async ({ page }) => {
  await page.route('**/api/v1/standards', (route) => route.fulfill({ json: {
    registry_version: '1', standards_count: 2, counts: { ISO: 1, ISTA: 1 }, last_verified_date: '2026-11-01',
    evaluation_statement: 'Evaluated against: ISO registry v1 (1 entries) and ISTA registry v1 (1 entries), last verified 2026-11-01.',
    standards: [
      { entry_id: 'ISO-2248', organization: 'ISO', standard_identifier: 'ISO 2248:1985', title: 'Packaging — Complete, filled transport packages — Vertical impact test', scope_summary: 'Vertical impact testing.', what_it_tests: 'Physical impact performance.', when_it_applies: 'When a vertical impact test is required.', source_url: 'https://www.iso.org/standard/26462.html', version: '1985', last_verified_date: '2026-11-01', check_type: 'PHYSICAL_TEST', is_user_editable: false },
      { entry_id: 'ISTA-3A', organization: 'ISTA', standard_identifier: 'ISTA 3A', title: 'Parcel delivery system shipments', scope_summary: 'Individual parcel shipments within published scope.', what_it_tests: 'General transport simulation.', when_it_applies: 'Individual parcel shipment.', source_url: 'https://ista.org/test_procedures.php', version: 'Current', last_verified_date: '2026-11-01', check_type: 'PHYSICAL_TEST', is_user_editable: false },
    ],
  } }))
  await page.goto('/standards')
  await expect(page.getByTestId('standards-evaluation-banner')).toContainText('ISO registry v1 (1 entries) and ISTA registry v1 (1 entries)')
  await expect(page.getByRole('button', { name: 'ISO (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'ISTA (1)' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add standard' })).toBeVisible()
  await page.screenshot({ path: path.resolve(process.cwd(), '../test-evidence/standards-iso-ista.png'), fullPage: true })
  await page.getByRole('button', { name: 'ISTA (1)' }).click()
  await expect(page.getByText('ISTA 3A')).toBeVisible()
  await expect(page.getByText('ISO 2248:1985')).toHaveCount(0)
})

test('repaired saved blender project renders with restored dimensions and test guidance', async ({ page }) => {
  const projectId = 'badc4582-a74a-441a-819e-bbb3e49c8601'
  const api = await page.request.get(`http://127.0.0.1:8000/api/v1/projects/${projectId}`)
  expect(api.ok()).toBeTruthy()
  const project = await api.json()
  expect(project.product_data.packed_dimensions).toMatchObject({ length: 180, width: 165, height: 390 })
  expect(project.product_data.product_type).toBe('blender')
  expect(project.product_data.components).toEqual([])

  await page.goto(`/projects/${projectId}`)
  await expect(page.getByTestId('product-dimensions')).toContainText('180.0 × 165.0 × 390.0 mm')
  await expect(page.locator('text=/ISO registry v1 \\(16 entries\\) and ISTA registry v1 \\(14 entries\\)/')).toBeVisible()
  await expect(page.getByTestId('geometry-source')).toContainText('Approximate model for blender')
  await page.getByRole('button', { name: 'Inside the Box' }).click()
  const debug = await page.waitForFunction(() => {
    const scene = (window as any).__NEXTPAK_3D_DEBUG__
    return scene?.productBox && scene?.productType === 'blender' ? scene : false
  })
  const scene = await debug.jsonValue() as SceneDebug
  expectBoxSize(scene.productBox.size, productDims)
  expect(scene.sceneObjectNames).toContain('product-model-blender')
  const evidence = path.resolve(process.cwd(), '../test-evidence/live-repaired-blender')
  await mkdir(evidence, { recursive: true })
  await page.screenshot({ path: path.join(evidence, 'inside.png'), fullPage: true })

  await page.getByRole('button', { name: 'Standards' }).click()
  await expect(page.getByText('Suggested validation tests (to be performed in an accredited lab)')).toBeVisible()
  await page.screenshot({ path: path.join(evidence, 'standards-test-plan.png'), fullPage: true })
})
