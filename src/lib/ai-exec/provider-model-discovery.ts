import { ApiError } from '@/lib/api-errors'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'

/** Gateways with large catalogs are still listed fully; only the response is capped. */
const MODEL_LIST_LIMIT = 500

export interface ProviderModelDiscoveryResult {
  models: string[]
  total: number
}

function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_BASE_URL_MISSING',
      field: 'baseUrl',
    })
  }
  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('PROTOCOL_INVALID')
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_BASE_URL_INVALID',
      field: 'baseUrl',
    })
  }
}

function readModelId(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (!value || typeof value !== 'object') return ''
  const record = value as Record<string, unknown>
  for (const key of ['id', 'model', 'name']) {
    const candidate = record[key]
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim()
  }
  return ''
}

/**
 * Gateways answer with `{ data: [...] }` (OpenAI), `{ models: [...] }` (some
 * proxies), a bare array, or plain strings. Accept all four shapes.
 */
function extractModelIds(payload: unknown): string[] {
  let candidates: unknown[] = []
  if (Array.isArray(payload)) {
    candidates = payload
  } else if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const nested = record.data ?? record.models ?? record.result
    if (Array.isArray(nested)) candidates = nested
  }

  const ids = new Set<string>()
  for (const candidate of candidates) {
    const id = readModelId(candidate)
    if (id) ids.add(id)
  }
  return Array.from(ids).sort((left, right) => left.localeCompare(right))
}

function throwForStatus(status: number): never {
  if (status === 401 || status === 403) {
    throw new ApiError('PROVIDER_AUTH_INVALID', {
      code: 'MODEL_DISCOVERY_AUTH_INVALID',
      field: 'apiKey',
      status,
    })
  }
  if (status === 429) {
    throw new ApiError('RATE_LIMIT', {
      code: 'MODEL_DISCOVERY_RATE_LIMITED',
      status,
    })
  }
  if (status === 404) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'MODEL_DISCOVERY_UNSUPPORTED',
      field: 'baseUrl',
      status,
    })
  }
  throw new ApiError('EXTERNAL_ERROR', {
    code: 'MODEL_DISCOVERY_FAILED',
    status,
  })
}

export async function discoverProviderModels(input: {
  baseUrl: string
  apiKey: string
}): Promise<ProviderModelDiscoveryResult> {
  const baseUrl = normalizeBaseUrl(input.baseUrl)
  const apiKey = input.apiKey.trim()
  if (!apiKey) {
    throw new ApiError('INVALID_PARAMS', {
      code: 'PROVIDER_API_KEY_MISSING',
      field: 'apiKey',
    })
  }

  let response: Response
  try {
    response = await fetchWithProviderProxy(`${baseUrl}/models`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })
  } catch {
    throw new ApiError('NETWORK_ERROR', {
      code: 'MODEL_DISCOVERY_UNREACHABLE',
      field: 'baseUrl',
    })
  }

  if (!response.ok) throwForStatus(response.status)

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new ApiError('EXTERNAL_ERROR', { code: 'MODEL_DISCOVERY_INVALID_RESPONSE' })
  }

  const models = extractModelIds(payload)
  if (models.length === 0) {
    throw new ApiError('EXTERNAL_ERROR', { code: 'MODEL_DISCOVERY_EMPTY' })
  }

  return { models: models.slice(0, MODEL_LIST_LIMIT), total: models.length }
}
