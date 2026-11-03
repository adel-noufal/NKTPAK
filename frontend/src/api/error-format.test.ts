import { describe, expect, it } from 'vitest'
import { formatApiErrorDetail } from './error-format'

describe('formatApiErrorDetail', () => {
  it('formats FastAPI validation arrays without coercing objects', () => {
    const result = formatApiErrorDetail([{ loc: ['body', 'product', 'brand'], msg: 'String should have at least 1 character', type: 'string_too_short' }])
    expect(result.issues[0]).toEqual({ loc: ['body', 'product', 'brand'], message: 'String should have at least 1 character', type: 'string_too_short' })
    expect(result.summary).not.toContain('[object Object]')
  })
  it('keeps string details readable', () => expect(formatApiErrorDetail('Invalid project').summary).toBe('Invalid project'))
  it('reads structured workflow details', () => {
    const result = formatApiErrorDetail({ error: 'Validation failed', details: [{ loc: ['body', 'baseline'], msg: 'invalid' }] })
    expect(result.summary).toBe('Validation failed')
    expect(result.issues).toHaveLength(1)
  })
})
