import { EXTERNAL_OPERATION } from '@/lib/external-operation/registry'
import type { AiProviderImageExecutionContext } from '@/lib/ai-providers/runtime-types'
import { requireSelectedModelId } from '@/lib/ai-providers/shared/model-selection'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import { AppError } from '@/lib/errors/app-error'
import { fetchProviderWithRetry, readProviderJsonResponse } from '@/lib/ai-providers/failure'
import { OPENAI_COMPATIBLE_IMAGE_TIMEOUT_MS } from './config'

export interface OpenAIImageGenerationResponse {
  data?: Array<{ url?: string; b64_json?: string }>
}

type OpenAIImageOptions = NonNullable<AiProviderImageExecutionContext['options']>

export async function executeOpenAICompatibleImageGeneration(
  input: AiProviderImageExecutionContext,
) {
  const options = (input.options ?? {}) as OpenAIImageOptions
  const { apiKey, baseUrl } = input.providerConfig
  if (!baseUrl) throw new Error('PROVIDER_BASE_URL_MISSING: openai-compatible (image)')
  if (!apiKey) {
    throw new AppError('PROVIDER_AUTH_INVALID', undefined, { provider: 'openai-compatible' })
  }
  const modelId = requireSelectedModelId(input.selection, 'openai-compatible:image')

  const response = await fetchProviderWithRetry({
    url: `${baseUrl.replace(/\/+$/, '')}/images/generations`,
    provider: 'openai-compatible',
    phase: 'submit',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        prompt: input.prompt,
        ...(options.size ? { size: options.size } : {}),
        ...(options.quality ? { quality: options.quality } : {}),
        ...(options.outputFormat ? { output_format: options.outputFormat } : {}),
      }),
      operation: EXTERNAL_OPERATION.PROVIDER_SUBMIT,
      timeoutMs: OPENAI_COMPATIBLE_IMAGE_TIMEOUT_MS,
      scope: 'openai-compatible:image',
      fetchFn: fetchWithProviderProxy,
    },
  })

  const data = await readProviderJsonResponse<OpenAIImageGenerationResponse>({
    response,
    provider: 'openai-compatible',
    phase: 'result',
  })

  const first = Array.isArray(data.data) ? data.data[0] : undefined
  const imageUrl = typeof first?.url === 'string' ? first.url.trim() : ''
  if (imageUrl) return { success: true as const, imageUrl }

  const imageBase64 = typeof first?.b64_json === 'string' ? first.b64_json.trim() : ''
  if (!imageBase64) {
    throw new Error('OPENAI_COMPATIBLE_IMAGE_EMPTY_RESPONSE: no image returned')
  }
  return {
    success: true as const,
    imageBase64,
    imageUrl: `data:image/png;base64,${imageBase64}`,
  }
}
