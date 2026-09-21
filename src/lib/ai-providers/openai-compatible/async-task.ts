import type {
  AsyncTaskProviderRegistration,
  ParsedAsyncExternalId,
} from '@/lib/ai-providers/async-task-types'
import { normalizeAsyncPollResult } from '@/lib/ai-providers/async-task-types'
import {
  OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE,
  OPENAI_COMPATIBLE_PROVIDER_KEY,
  buildOpenAICompatibleExternalId,
  canParseOpenAICompatibleExternalId,
  parseOpenAICompatibleExternalId,
} from './external-id'
import { queryOpenAICompatibleVideoStatus } from './video'

function toParsedExternalId(externalId: string): ParsedAsyncExternalId {
  const parsed = parseOpenAICompatibleExternalId(externalId)
  return {
    provider: parsed.providerCode,
    type: parsed.type,
    requestId: parsed.requestId,
    // The configured Provider instance that owns the job; polling must load this
    // exact credential rather than the family default.
    providerToken: parsed.providerId,
  }
}

export const openAICompatibleAsyncTaskProvider: AsyncTaskProviderRegistration = {
  providerCode: OPENAI_COMPATIBLE_ASYNC_PROVIDER_CODE,
  providerKey: OPENAI_COMPATIBLE_PROVIDER_KEY,
  canParseExternalId: canParseOpenAICompatibleExternalId,
  parseExternalId: toParsedExternalId,
  formatExternalId: (input) => buildOpenAICompatibleExternalId({
    type: input.type,
    providerId: input.providerToken ?? OPENAI_COMPATIBLE_PROVIDER_KEY,
    requestId: input.requestId,
  }),
  poll: async ({ parsed, context }) => {
    const providerId = parsed.providerToken ?? OPENAI_COMPATIBLE_PROVIDER_KEY
    const { apiKey, baseUrl } = await context.getProviderConfig(context.userId, providerId)
    if (!baseUrl) throw new Error('PROVIDER_BASE_URL_MISSING: openai-compatible (video)')

    const result = await queryOpenAICompatibleVideoStatus({
      baseUrl,
      apiKey,
      jobId: parsed.requestId,
    })
    return normalizeAsyncPollResult({
      status: result.status,
      ...(result.status === 'failed' ? { failure: result.failure } : {}),
      videoUrl: result.videoUrl,
      resultUrl: result.resultUrl,
      downloadHeaders: result.downloadHeaders,
    })
  },
}
