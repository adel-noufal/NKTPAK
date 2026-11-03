import { expect, test, type Page } from '@playwright/test'

const projectId = 'playwright-created-project'
const fanCandidate = {
  candidate_id: 'fan-tsf-16w', name: 'Tornado Stand Fan', brand: 'Tornado', model: 'TSF-16W', category: 'stand fan',
  net_weight_kg: 7.3, dimensions_mm: { length: 460, width: 400, height: 1400 },
  carton_dimensions_mm: { length: 575, width: 510, height: 1510 },
  provenance: { source_name: 'Playwright fixture', source_type: 'PUBLIC_RETAIL' },
}
const alternateFanCandidate = {
  ...fanCandidate, candidate_id: 'alternate-fan', name: 'Fresh Stand Fan', brand: 'Fresh', model: 'FSF-16',
  source_url: 'https://fresh.example/products/stand-fan', provenance: { ...fanCandidate.provenance, source_name: 'fresh.example', source_url: 'https://fresh.example/products/stand-fan' },
}

async function mockApi(page: Page, invalidCreate = false) {
  let submittedPayload: any
  page.on('pageerror', (error) => console.log('PAGE_ERROR', error.message, error.stack))
  await page.route('**/api/health', (route) => route.fulfill({ json: { status: 'healthy' } }))
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname.endsWith('/extract-from-description')) {
      await route.fulfill({ json: {
        name: 'Tornado Blender BL500/2', brand: 'Tornado', model_number: 'BL500/2', product_type: 'blender',
        net_weight_kg: 3.2, fragility: 'MEDIUM', product_length_mm: 180, product_width_mm: 165, product_height_mm: 390,
        carton_length_mm: 240, carton_width_mm: 225, carton_height_mm: 450, board_type: 'BC Double Wall',
        fields: [{ field: 'product_type', provenance: 'FROM_DESCRIPTION' }], missing_required: [], llm_offline: true, extraction_notes: 'Fixture',
      } })
      return
    }
    if (url.pathname.endsWith('/fetch-product')) {
      await route.fulfill({ json: { query: 'fan', normalized_query: 'FAN', candidates: [fanCandidate, alternateFanCandidate], exact_match: false, cached: true, status_message: 'Found' } })
      return
    }
    if (url.pathname.endsWith('/specs')) {
      await route.fulfill({ status: 503, json: { detail: 'Fixture has no extra specifications.' } })
      return
    }
    if (url.pathname.endsWith('/recommendation')) {
      await route.fulfill({ status: 503, json: { detail: 'Recommendation fixture not configured.' } })
      return
    }
    if (url.pathname.endsWith('/assistant')) {
      const body = request.postDataJSON()
      const missing = body.page_context?.missing_fields || []
      await route.fulfill({ json: {
        reply: missing.length ? `Required information still missing: ${missing.join(', ')}.` : 'No required fields are missing on this form.',
        mode: 'offline', provider_name: 'test', tools_called: ['get_validation_errors'], fields_cited: ['missing_fields'],
      } })
      return
    }
    if (request.method() === 'POST' && url.pathname.endsWith('/projects')) {
      submittedPayload = request.postDataJSON()
      if (invalidCreate) {
        submittedPayload.product.brand = 'B'.repeat(101)
        await route.fulfill({ status: 422, json: { detail: [{ loc: ['body', 'product', 'brand'], msg: 'String should have at most 100 characters', type: 'string_too_long' }] } })
      } else {
        await route.fulfill({ status: 201, json: { project_id: projectId, name: submittedPayload.name, status: 'completed' } })
      }
      return
    }
    if (request.method() === 'GET' && url.pathname.endsWith(`/projects/${projectId}`)) {
      await route.fulfill({ json: {
        project_id: projectId, short_id: projectId.slice(0, 8), name: submittedPayload?.name || 'New packaging project',
        brand: submittedPayload?.product?.brand || 'Tornado', model_number: submittedPayload?.product?.model || 'BL500/2',
        sku: submittedPayload?.product?.sku || null, description: submittedPayload?.description || null, status: 'completed', language: 'en',
        product_data: submittedPayload?.product, components_data: [], baseline_data: submittedPayload?.baseline,
        planned_data: null, optimization_config: submittedPayload?.optimization_config, optimization_result: null,
        standards_result: null, chat_history: [], created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-01T00:00:00Z',
      } })
      return
    }
    if (url.pathname.endsWith('/brands') || url.pathname.endsWith('/standards')) {
      await route.fulfill({ json: [] })
      return
    }
    await route.fulfill({ status: 200, json: {} })
  })
  return () => submittedPayload
}

async function fillRemainingRequiredFields(page: Page, productType: 'blender' | 'stand_fan', name: string, brand: string, model: string, preserveExtractedType = false) {
  await page.getByPlaceholder('e.g. Tornado Stand Fan TSF-16W').fill(name)
  await page.getByPlaceholder('e.g. Tornado, Toshiba').fill(brand)
  await page.getByPlaceholder('e.g. TSF-16W or BL500/2').last().fill(model)
  if (!preserveExtractedType) await page.getByTestId('product-type-select').selectOption(productType)
  await page.locator('form select').nth(1).selectOption('MEDIUM')
  await page.locator('form select').nth(2).selectOption({ label: 'BC Double Wall (~5.0 mm - Standard)' })
  const requiredValues: Record<string, string> = {
    'e.g. 7.3': productType === 'blender' ? '3.2' : '7.3',
    'e.g. 520': productType === 'blender' ? '180' : '460',
    'e.g. 280': productType === 'blender' ? '165' : '400',
    'e.g. 450': productType === 'blender' ? '390' : '1400',
    'e.g. 575': productType === 'blender' ? '240' : '575',
    'e.g. 310': productType === 'blender' ? '225' : '510',
    'e.g. 490': productType === 'blender' ? '450' : '1510',
    'e.g. 5.0': '5', 'e.g. 22.5': '22.5', 'e.g. 16': '16',
  }
  for (const [placeholder, value] of Object.entries(requiredValues)) await page.getByPlaceholder(placeholder).fill(value)
}

async function createAndAssertProject(page: Page, screenshotPath: string, expectedName: string) {
  await page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ }).click()
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}(?:\\?.*)?$`))
  await expect(page.getByText('Project Not Found')).toHaveCount(0)
  await expect(page.getByText(expectedName, { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: '3D Workspace' }).click()
  await page.screenshot({ path: screenshotPath, fullPage: true })
}

test('create blender from free-text description and open its project page', async ({ page }) => {
  const getPayload = await mockApi(page)
  await page.goto('/projects/new')
  await page.locator('textarea').fill('Tornado blender, model BL500/2, net weight 3.2 kg, dimensions 180 x 165 x 390 mm, carton 240 x 225 x 450 mm, BC Double Wall, medium fragility.')
  const extractionResponse = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith('/extract-from-description'))
  await page.getByRole('button', { name: 'Analyse & Extract Specs' }).click()
  await extractionResponse
  await expect(page.getByTestId('product-type-select')).toHaveValue('blender')
  await fillRemainingRequiredFields(page, 'blender', 'Tornado Blender BL500/2', 'Tornado', 'BL500/2', true)
  await createAndAssertProject(page, test.info().outputPath('new-project-blender.png'), 'Tornado Blender BL500/2')
  expect(getPayload().product.product_type_provenance.source_type).toBe('FROM_DESCRIPTION')
  expect(getPayload().product.provenance.source_type).toBe('FROM_DESCRIPTION')
  expect(getPayload().baseline.provenance.source_type).toBe('FROM_DESCRIPTION')
})

test('create a fan from product fetch and open its project page', async ({ page }) => {
  const getPayload = await mockApi(page)
  await page.goto('/projects/new')
  await page.getByRole('button', { name: 'Live Web Fetch' }).click()
  await page.getByPlaceholder('Enter a product name').fill('fan')
  await page.getByRole('button', { name: 'Fetch Specifications' }).click()
  await expect(page.getByRole('button', { name: 'Use this product' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Select candidate/ })).toHaveCount(2)
  await expect(page.locator('[data-validation-field="brand"]')).toHaveValue('')
  await page.getByRole('button', { name: 'Select candidate Tornado Stand Fan' }).click()
  await page.getByRole('button', { name: 'Use this product' }).click()
  await expect(page.getByText(/Brand: From web fetch: Playwright fixture/)).toBeVisible()
  await fillRemainingRequiredFields(page, 'stand_fan', 'Tornado Stand Fan TSF-16W', 'Tornado', 'TSF-16W')
  await createAndAssertProject(page, test.info().outputPath('new-project-fan.png'), 'Tornado Stand Fan TSF-16W')
  expect(getPayload().product.product_type).toBe('stand_fan')
})

test('maps a FastAPI 422 response to a red field message', async ({ page }) => {
  const getPayload = await mockApi(page, true)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Manual Blender Project', 'Tornado', 'BL500/2')
  await page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ }).click()
  const validationSummary = page.locator('form [role="alert"]')
  await expect(validationSummary).toContainText('Please correct these fields')
  await expect(validationSummary).toContainText('Brand: String should have at most 100 characters')
  await expect(page.getByTestId('product-type-select')).toHaveAttribute('aria-invalid', 'false')
  await expect(page.locator('[data-validation-field="brand"]')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('[data-validation-field="brand"]')).toHaveClass(/border-rose-400/)
  await expect(validationSummary).not.toContainText('[object Object]')
  expect(getPayload().product.brand).toHaveLength(101)
  await page.screenshot({ path: test.info().outputPath('invalid-project-validation.png'), fullPage: true })
})

test('shows missing fragility immediately and flags implausible board thickness', async ({ page }) => {
  await mockApi(page)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Validation Blender Project', 'Tornado', 'BL500/2')
  const fragility = page.locator('form select').nth(1)
  await fragility.selectOption('')
  await expect(fragility).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('1 field still needed:', { exact: false })).toBeVisible()
  await expect(page.getByText('Fragility class', { exact: true })).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('missing-fragility.png'), fullPage: true })
  await fragility.selectOption('MEDIUM')
  await expect(fragility).toHaveAttribute('aria-invalid', 'false')
  await expect(page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ })).toBeEnabled()

  const thickness = page.getByPlaceholder('e.g. 5.0')
  await thickness.fill('51.1')
  await expect(thickness).toHaveAttribute('aria-invalid', 'true')
  await expect(page.getByText('Enter a board thickness from 1 to 15 mm.')).toBeVisible()
  await page.screenshot({ path: test.info().outputPath('implausible-board-thickness.png'), fullPage: true })
  await thickness.fill('5')
  await expect(thickness).toHaveAttribute('aria-invalid', 'false')
})

test('assistant receives New Project validation state and names the missing field', async ({ page }) => {
  await mockApi(page)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Assistant Context Project', 'Tornado', 'BL500/2')
  await page.locator('form select').nth(1).selectOption('')
  await expect(page.getByText('1 field still needed:', { exact: false })).toBeVisible()
  await page.getByRole('button', { name: 'Open AI Packaging Assistant' }).click()
  await expect(page.getByText('Looking at: New Project · Specifications form')).toBeVisible()
  await page.getByRole('button', { name: 'What is missing?' }).click()
  await expect(page.getByText('Required information still missing: Fragility class.')).toBeVisible()
  await expect(page.locator('[role="dialog"]')).not.toContainText('**')
  await page.screenshot({ path: test.info().outputPath('assistant-missing-fragility.png'), fullPage: true })
})

test('search failure shows a retry state without a candidate card', async ({ page }) => {
  await mockApi(page)
  await page.route('**/api/v1/fetch-product', (route) => route.fulfill({ json: {
    query: 'stand fan', normalized_query: 'STANDFAN', candidates: [], exact_match: false, cached: false,
    status_message: "No products found for 'stand fan'. You can enter specifications manually or upload a CAD model.",
    diagnostics: [{ source: 'Gemini Google Search', status: 'error', count: 0, error: 'Gemini Google Search returned HTTP 503: temporary capacity limit.' }],
  } }))
  await page.goto('/projects/new')
  await page.getByRole('button', { name: 'Live Web Fetch' }).click()
  await page.getByPlaceholder('Enter a product name').fill('stand fan')
  await page.getByRole('button', { name: 'Fetch Specifications' }).click()
  await expect(page.getByRole('alert')).toContainText('Web search is temporarily unavailable')
  await expect(page.getByRole('button', { name: 'Retry search' })).toBeVisible()
  await expect(page.getByText('Select Product Candidate', { exact: false })).toHaveCount(0)
  await page.screenshot({ path: test.info().outputPath('search-source-failure.png'), fullPage: true })
})

test('rejects an invalid form payload and reports it before sending', async ({ page }) => {
  const getPayload = await mockApi(page)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Invalid Blender Project', 'Tornado', 'BL500/2')
  await page.getByPlaceholder('e.g. Tornado, Toshiba').fill('B'.repeat(101))
  await expect(page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ })).toBeDisabled()
  await page.locator('form button[type="submit"]').evaluate((button) => { (button as HTMLButtonElement).disabled = false })
  await page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ }).click()
  const validationSummary = page.locator('form [role="alert"]')
  await expect(validationSummary).toContainText('Please correct these fields')
  await expect(validationSummary).toContainText('Brand:')
  await expect(validationSummary).toContainText(/100/)
  await expect(page.locator('[data-validation-field="brand"]')).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('[data-validation-field="brand"]')).toHaveClass(/border-rose-400/)
  await expect(page.getByText(/Needs correction: Brand/)).toBeVisible()
  await expect(page.getByText(/All mandatory packaging engineering inputs ready/)).toHaveCount(0)
  await expect(validationSummary).not.toContainText('[object Object]')
  expect(getPayload()).toBeUndefined()
  await page.screenshot({ path: test.info().outputPath('invalid-project-validation.png'), fullPage: true })
})

test('create a manual project and open its project page', async ({ page }) => {
  await mockApi(page)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Manual Blender Project', 'Tornado', 'BL500/2')
  await createAndAssertProject(page, test.info().outputPath('new-project-manual.png'), 'Manual Blender Project')
})

test('creates a project when the model number is unknown', async ({ page }) => {
  const getPayload = await mockApi(page)
  await page.goto('/projects/new')
  await fillRemainingRequiredFields(page, 'blender', 'Unidentified Blender Project', 'Tornado', 'BL500/2')
  await page.getByPlaceholder('e.g. TSF-16W or BL500/2').fill('')
  const generate = page.getByRole('button', { name: /Generate Optimized Packaging Alternatives/ })
  await expect(generate).toBeEnabled()
  await createAndAssertProject(page, test.info().outputPath('new-project-no-model.png'), 'Unidentified Blender Project')
  expect(getPayload().product.model).toBeUndefined()
})
