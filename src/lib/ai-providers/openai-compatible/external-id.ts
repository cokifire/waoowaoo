import type { AsyncExternalIdType } from '@/lib/ai-providers/async-task-types'

/**
 * A user may configure several `openai-compatible` endpoints, each with its own
 * base URL and key. The async job therefore has to remember which Provider
 * *instance* created it, or polling would load the wrong credentials.
 *
 * The instance id travels percent-encoded because it contains the family
 * separator (`openai-compatible:my-gateway`) and `:` is the externalId
 * delimiter.
 */
export const OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE = 'OPENAI_COMPATIBLE'

export const OPENAI_COMPATIBLE_PROVIDER_KEY = 'openai-compatible'

export interface ParsedOpenAICompatibleExternalId {
  providerCode: typeof OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE
  type: AsyncExternalIdType
  providerId: string
  requestId: string
}

export function encodeOpenAICompatibleProviderToken(providerId: string): string {
  const normalized = providerId.trim().toLowerCase()
  if (!normalized) throw new Error('OPENAI_COMPATIBLE_EXTERNAL_ID_PROVIDER_MISSING')
  return encodeURIComponent(normalized)
}

export function decodeOpenAICompatibleProviderToken(token: string): string {
  let decoded = ''
  try {
    decoded = decodeURIComponent(token).trim().toLowerCase()
  } catch {
    throw new Error(`OPENAI_COMPATIBLE_EXTERNAL_ID_PROVIDER_INVALID:${token}`)
  }
  if (!decoded) throw new Error('OPENAI_COMPATIBLE_EXTERNAL_ID_PROVIDER_MISSING')
  return decoded
}

export function buildOpenAICompatibleExternalId(input: {
  type: AsyncExternalIdType
  providerId: string
  requestId: string
}): string {
  return [
    OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE,
    input.type,
    encodeOpenAICompatibleProviderToken(input.providerId),
    input.requestId,
  ].join(':')
}

export function buildOpenAICompatibleVideoExternalId(input: {
  providerId: string
  jobId: string
}): string {
  return buildOpenAICompatibleExternalId({
    type: 'VIDEO',
    providerId: input.providerId,
    requestId: input.jobId,
  })
}

export function canParseOpenAICompatibleExternalId(externalId: string): boolean {
  return externalId.startsWith(`${OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE}:`)
}

export function parseOpenAICompatibleExternalId(externalId: string): ParsedOpenAICompatibleExternalId {
  const parts = externalId.split(':')
  const [providerCode, rawType, providerToken] = parts
  const requestId = parts.slice(3).join(':')
  const type = (rawType ?? '').trim().toUpperCase()
  if (
    providerCode !== OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE
    || (type !== 'VIDEO' && type !== 'IMAGE')
    || !providerToken
    || !requestId
  ) {
    throw new Error(
      `无效 OPENAI_COMPATIBLE externalId: "${externalId}"，`
      + `应为 ${OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE}:TYPE:providerId:requestId`,
    )
  }
  return {
    providerCode: OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE,
    type,
    providerId: decodeOpenAICompatibleProviderToken(providerToken),
    requestId,
  }
}
