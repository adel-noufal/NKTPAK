import { readFile, writeFile } from 'node:fs/promises'

const openapi = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'))
const values = openapi.components.schemas.ProductInput.properties.product_type.enum
const contents = `// Generated from ../openapi.json. Do not edit by hand.\nexport const PRODUCT_TYPES = ${JSON.stringify(values)} as const\nexport type ProductType = (typeof PRODUCT_TYPES)[number]\n`
await writeFile(new URL('../src/api/product-types.ts', import.meta.url), contents)
