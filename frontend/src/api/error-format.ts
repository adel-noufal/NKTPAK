export interface ApiFieldIssue {
  loc: Array<string | number>
  message: string
  type?: string
}

export interface FormattedApiDetail {
  summary: string
  issues: ApiFieldIssue[]
}

function readable(value: unknown): string | null {
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  return null
}

export function formatApiErrorDetail(detail: unknown): FormattedApiDetail {
  if (typeof detail === 'string') return { summary: detail, issues: [] }
  if (Array.isArray(detail)) {
    const issues = detail.flatMap((item): ApiFieldIssue[] => {
      if (!item || typeof item !== 'object') return []
      const entry = item as Record<string, unknown>
      const loc = Array.isArray(entry.loc) ? entry.loc.filter((part): part is string | number => typeof part === 'string' || typeof part === 'number') : []
      const message = readable(entry.msg) || readable(entry.message)
      return message ? [{ loc, message, type: readable(entry.type) || undefined }] : []
    })
    return { summary: issues.length ? 'Please correct the highlighted fields.' : 'The server rejected the submitted data.', issues }
  }
  if (detail && typeof detail === 'object') {
    const entry = detail as Record<string, unknown>
    const summary = readable(entry.error) || readable(entry.message) || readable(entry.detail)
    const nested = formatApiErrorDetail(entry.details ?? entry.errors)
    if (nested.issues.length) return { summary: summary || nested.summary, issues: nested.issues }
    return { summary: summary || 'The server rejected the submitted data.', issues: [] }
  }
  return { summary: 'The server rejected the submitted data.', issues: [] }
}
