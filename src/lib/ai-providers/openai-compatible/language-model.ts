import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { AiProviderLanguageModelContext } from '@/lib/ai-providers/runtime-types'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'

/**
 * Any endpoint speaking OpenAI Chat Completions. The model id is whatever the
 * user configured, so the protocol comes from the Manifest default rather than
 * from a builtin capability catalog entry.
 */
export function createOpenAICompatibleLanguageModel(input: AiProviderLanguageModelContext) {
  if (input.protocol !== 'openai-compatible-chat') {
    throw new Error(`LLM_PROTOCOL_PROVIDER_MISMATCH:openai-compatible:${input.protocol}`)
  }
  const baseURL = input.providerConfig.baseUrl?.trim()
  if (!baseURL) throw new Error('PROVIDER_BASE_URL_MISSING: openai-compatible (language-model)')

  const provider = createOpenAICompatible({
    baseURL,
    apiKey: input.providerConfig.apiKey,
    name: input.providerKey,
    fetch: fetchWithProviderProxy,
    includeUsage: true,
  })
  return provider.chatModel(input.selection.modelId)
}
