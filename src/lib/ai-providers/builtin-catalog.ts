import { AI_PROVIDER_MANIFESTS } from '@/lib/ai-providers/manifests'
import type {
  ProviderCapabilityCatalogDeclaration,
  ProviderPricingCatalogDeclaration,
} from '@/lib/ai-providers/manifest'
import type { ApiConfigCatalogModel } from '@/lib/ai-registry/api-config-catalog'
import type { AiLlmProtocol } from '@/lib/ai-registry/types'

export function listBuiltinCapabilityCatalogEntries(): readonly ProviderCapabilityCatalogDeclaration[] {
  return AI_PROVIDER_MANIFESTS.flatMap((manifest) => manifest.catalogs.capabilities)
}

/**
 * Bring-your-own-model providers ship no catalog; their models are whatever the
 * user typed. The Manifest protocol becomes the provider-level default.
 */
export function listBuiltinLlmProtocolFallbacks(): ReadonlyMap<string, AiLlmProtocol> {
  const fallbacks = new Map<string, AiLlmProtocol>()
  for (const manifest of AI_PROVIDER_MANIFESTS) {
    if (!manifest.defaultLlmProtocol) continue
    fallbacks.set(manifest.providerKey, manifest.defaultLlmProtocol)
  }
  return fallbacks
}

export function listBuiltinPricingCatalogEntries(): readonly ProviderPricingCatalogDeclaration[] {
  return AI_PROVIDER_MANIFESTS.flatMap((manifest) => manifest.catalogs.pricing)
}

export function listBuiltinApiConfigCatalogModels(): readonly ApiConfigCatalogModel[] {
  return AI_PROVIDER_MANIFESTS.flatMap((manifest) => manifest.catalogs.apiConfigModels)
}
