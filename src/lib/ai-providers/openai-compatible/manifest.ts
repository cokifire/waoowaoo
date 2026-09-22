import { openaiCompatibleAdapter } from '@/lib/ai-providers/openai-compatible/adapter'
import { openAICompatibleAsyncTaskProvider } from '@/lib/ai-providers/openai-compatible/async-task'
import { defineAiProviderManifest } from '@/lib/ai-providers/manifest'

const VISION_IMAGE_TRANSPORTS = ['inline-data-url', 'public-https'] as const

/**
 * Bring-your-own-endpoint provider. All four catalogs are intentionally empty:
 * the user supplies the base URL, the credential and every model id, and the
 * Manifest protocol covers models the capability catalog has never seen.
 *
 * Video follows the official OpenAI Videos API (`/videos` + `/videos/{id}`),
 * which is asynchronous and therefore ships an async-task registration.
 */
export const openaiCompatibleProviderManifest = defineAiProviderManifest({
  providerKey: 'openai-compatible',
  adapter: openaiCompatibleAdapter,
  apiConfig: {
    visibility: 'visible',
    name: 'OpenAI Compatible',
    supportedModelTypes: ['llm', 'image', 'video'],
  },
  platformCredentials: {
    envPrefix: 'PLATFORM_OPENAI_COMPATIBLE',
    requiresBaseUrl: true,
  },
  defaultLlmProtocol: 'openai-compatible-chat',
  asyncTasks: [openAICompatibleAsyncTaskProvider],
  catalogs: {
    capabilities: [],
    pricing: [],
    apiConfigModels: [],
    platformModels: [],
  },
  mediaInputs: [
    { modality: 'image', transports: { image: VISION_IMAGE_TRANSPORTS } },
    { modality: 'vision', transports: { image: VISION_IMAGE_TRANSPORTS } },
    { modality: 'video', transports: { image: VISION_IMAGE_TRANSPORTS } },
  ],
})
