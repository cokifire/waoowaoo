import { createAiSdkConnectionTester } from '@/lib/ai-providers/shared/connection-test'
import { openaiCompatibleFailureAdapter } from './failure'
import { createOpenAICompatibleLanguageModel } from './language-model'
import { OPENAI_COMPATIBLE_PROVIDER_TEST_LLM_MODEL_ID } from './config'

export const openaiCompatibleConnectionTester = createAiSdkConnectionTester({
  providerKey: 'openai-compatible',
  failure: openaiCompatibleFailureAdapter,
  displayName: 'OpenAI Compatible',
  defaultBaseUrl: '',
  defaultTestModel: OPENAI_COMPATIBLE_PROVIDER_TEST_LLM_MODEL_ID,
  protocol: 'openai-compatible-chat',
  createLanguageModel: createOpenAICompatibleLanguageModel,
})
