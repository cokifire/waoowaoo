import type { AiProviderAdapter } from '@/lib/ai-providers/runtime-types'
import { describeMediaVariantBase } from '@/lib/ai-providers/shared/media-adapter'
import { executeOpenAICompatibleImageGeneration } from './image'
import { executeOpenAICompatibleVideoGeneration } from './video'
import { createOpenAICompatibleLanguageModel } from './language-model'
import { openaiCompatibleFailureAdapter } from './failure'
import { openaiCompatibleConnectionTester } from './connection-test'
import { resolveOpenAICompatibleOptionSchema } from './option-schema'

export const openaiCompatibleAdapter: AiProviderAdapter = {
  providerKey: 'openai-compatible',
  failure: openaiCompatibleFailureAdapter,
  image: {
    describe: (selection) => describeMediaVariantBase({
      modality: 'image',
      selection,
      executionMode: 'sync',
      optionSchema: resolveOpenAICompatibleOptionSchema('image'),
    }),
    execute: executeOpenAICompatibleImageGeneration,
  },
  video: {
    describe: (selection) => describeMediaVariantBase({
      modality: 'video',
      selection,
      executionMode: 'async',
      optionSchema: resolveOpenAICompatibleOptionSchema('video'),
    }),
    execute: executeOpenAICompatibleVideoGeneration,
  },
  languageModel: {
    create: createOpenAICompatibleLanguageModel,
  },
  connectionTest: openaiCompatibleConnectionTester,
}
