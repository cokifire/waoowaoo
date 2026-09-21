import { describe, expect, it } from 'vitest'
import {
  buildProviderInstanceId,
  mergeProvidersForDisplay,
} from '@/app/[locale]/profile/components/api-config/selectors'
import type { Provider } from '@/app/[locale]/profile/components/api-config/types'

const CATALOG_OPENAI_COMPATIBLE: Provider = {
  id: 'openai-compatible',
  name: 'OpenAI Compatible',
  featured: true,
  connectionTest: true,
  modelTypes: ['llm', 'image', 'video'],
  supportsCustomBaseUrl: true,
  modelDiscovery: true,
}

describe('buildProviderInstanceId', () => {
  it('derives a model-key safe slug from an ascii name', () => {
    expect(buildProviderInstanceId({
      baseProviderId: 'openai-compatible',
      name: 'My Gateway #1',
      existingIds: new Set(),
    })).toBe('openai-compatible:my-gateway-1')
  })

  it('falls back to a numbered instance for non-latin names', () => {
    expect(buildProviderInstanceId({
      baseProviderId: 'openai-compatible',
      name: '硅基流动',
      existingIds: new Set(),
    })).toBe('openai-compatible:instance')
  })

  it('never collides with an existing id', () => {
    const existingIds = new Set([
      'openai-compatible:my-gateway',
      'openai-compatible:my-gateway-2',
    ])
    expect(buildProviderInstanceId({
      baseProviderId: 'openai-compatible',
      name: 'My Gateway',
      existingIds,
    })).toBe('openai-compatible:my-gateway-3')
  })
})

describe('mergeProvidersForDisplay with instances', () => {
  it('keeps the instance identity and inherits family capabilities', () => {
    const [merged] = mergeProvidersForDisplay(
      [{
        id: 'openai-compatible:my-gateway',
        name: 'My Gateway',
        baseUrl: 'https://gateway.example.com/v1',
        hasApiKey: true,
      }],
      [{ ...CATALOG_OPENAI_COMPATIBLE }],
    )

    expect(merged.id).toBe('openai-compatible:my-gateway')
    expect(merged.name).toBe('My Gateway')
    expect(merged.baseUrl).toBe('https://gateway.example.com/v1')
    expect(merged.hasApiKey).toBe(true)
    // Capabilities come from the catalog family, not from the saved record.
    expect(merged.modelTypes).toEqual(['llm', 'image', 'video'])
    expect(merged.supportsCustomBaseUrl).toBe(true)
    expect(merged.modelDiscovery).toBe(true)
  })

  it('still shows the catalog card next to an instance', () => {
    const merged = mergeProvidersForDisplay(
      [{ id: 'openai-compatible:my-gateway', name: 'My Gateway', hasApiKey: true }],
      [{ ...CATALOG_OPENAI_COMPATIBLE }],
    )
    expect(merged.map((provider) => provider.id)).toEqual([
      'openai-compatible:my-gateway',
      'openai-compatible',
    ])
  })

  it('lets the saved catalog record override only the credential view', () => {
    const [merged] = mergeProvidersForDisplay(
      [{
        id: 'openai-compatible',
        name: 'OpenAI Compatible',
        baseUrl: 'https://gateway.example.com/v1',
        hasApiKey: true,
      }],
      [{ ...CATALOG_OPENAI_COMPATIBLE }],
    )
    expect(merged.id).toBe('openai-compatible')
    expect(merged.baseUrl).toBe('https://gateway.example.com/v1')
    expect(merged.hasApiKey).toBe(true)
  })
})
