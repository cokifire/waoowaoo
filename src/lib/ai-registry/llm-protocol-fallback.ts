import { getProviderKey, parseModelKeyStrict } from './selection'
import type { AiLlmProtocol } from './types'

/**
 * Provider-level default LLM protocol.
 *
 * Bring-your-own-model providers cannot ship a hardcoded capability catalog:
 * the model id is whatever the user typed. Their Manifest therefore declares a
 * single protocol that applies to every model under that provider when the
 * builtin capability catalog has no entry for it.
 *
 * Kept in the registry layer (not resolved by importing Manifests) so the
 * composition root stays the only place that reads provider Manifests.
 */

let registeredFallbacks: ReadonlyMap<string, AiLlmProtocol> = new Map()

export function registerBuiltinLlmProtocolFallbacks(
  entries: ReadonlyMap<string, AiLlmProtocol>,
): void {
  const next = new Map<string, AiLlmProtocol>()
  for (const [providerKey, protocol] of entries) {
    const normalized = providerKey.trim().toLowerCase()
    if (!normalized) continue
    next.set(normalized, protocol)
  }
  registeredFallbacks = next
}

export function resolveBuiltinLlmProtocolFallback(providerId: string): AiLlmProtocol | undefined {
  const providerKey = getProviderKey(providerId.trim().toLowerCase())
  if (!providerKey) return undefined
  return registeredFallbacks.get(providerKey)
}

export function resolveBuiltinLlmProtocolFallbackByModelKey(
  modelKey: string,
): AiLlmProtocol | undefined {
  const parsed = parseModelKeyStrict(modelKey)
  if (!parsed) return undefined
  return resolveBuiltinLlmProtocolFallback(parsed.provider)
}

export function resetBuiltinLlmProtocolFallbacksForTest(): void {
  registeredFallbacks = new Map()
}
