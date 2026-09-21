import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ensureAiCatalogsRegistered } from '@/lib/ai-exec/catalog-bootstrap'
import {
  isApiConfigCatalogProviderId,
  listApiConfigCatalogProviders,
} from '@/lib/ai-registry/api-config-catalog'
import { registerBuiltinCapabilityCatalogEntries } from '@/lib/ai-registry/capabilities-catalog'
import {
  resolveRegisteredLlmProtocol,
  resolveRegisteredPublicReasoningMode,
} from '@/lib/ai-registry/llm-protocol'
import { listBuiltinCapabilityCatalogEntries } from '@/lib/ai-providers/builtin-catalog'
import { resolveAiProviderManifest } from '@/lib/ai-providers/manifests'

beforeAll(() => {
  ensureAiCatalogsRegistered()
})

describe('openai-compatible provider', () => {
  it('registers a bring-your-own-model provider with no default base url', () => {
    const manifest = resolveAiProviderManifest('openai-compatible')
    expect(manifest.defaultLlmProtocol).toBe('openai-compatible-chat')
    expect(manifest.apiConfig?.baseUrl).toBeUndefined()
    expect(manifest.apiConfig?.supportedModelTypes).toEqual(['llm', 'image', 'video'])
  })

  it('resolves a protocol for models the capability catalog has never seen', () => {
    expect(resolveRegisteredLlmProtocol('openai-compatible:my-gateway::qwen-max'))
      .toBe('openai-compatible-chat')
    expect(resolveRegisteredPublicReasoningMode('openai-compatible:my-gateway::qwen-max'))
      .toBe('none')
  })

  it('keeps rejecting providers that declare no protocol at all', () => {
    expect(() => resolveRegisteredLlmProtocol('unknown-provider::whatever'))
      .toThrow(/LLM_PROTOCOL_NOT_REGISTERED/)
  })

  it('offers llm, image and video slots even though its catalogs are empty', () => {
    expect(isApiConfigCatalogProviderId('openai-compatible:my-gateway')).toBe(true)
    const provider = listApiConfigCatalogProviders()
      .find((candidate) => candidate.id === 'openai-compatible')
    expect(provider?.modelTypes).toEqual(['llm', 'image', 'video'])
  })

  it('still resolves catalogued models through the capability catalog', () => {
    expect(resolveRegisteredLlmProtocol('openrouter::openai/gpt-5.6-luna')).toBe('openrouter-chat')
  })
})

describe('protocol fallback precedence', () => {
  afterAll(() => {
    registerBuiltinCapabilityCatalogEntries(listBuiltinCapabilityCatalogEntries())
  })

  it('prefers a builtin capability entry over the provider default', () => {
    registerBuiltinCapabilityCatalogEntries([{
      modelType: 'llm',
      provider: 'openai-compatible',
      modelId: 'pinned',
      capabilities: { llm: { protocol: 'openrouter-chat' } },
    }])
    expect(resolveRegisteredLlmProtocol('openai-compatible::pinned')).toBe('openrouter-chat')
    expect(resolveRegisteredLlmProtocol('openai-compatible::unpinned')).toBe('openai-compatible-chat')
  })
})
