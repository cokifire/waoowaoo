import { resolveBuiltinCapabilitiesByModelKey } from '@/lib/ai-registry/capabilities-catalog'
import { resolveBuiltinLlmProtocolFallbackByModelKey } from '@/lib/ai-registry/llm-protocol-fallback'
import type { AiLlmProtocol, AiPublicReasoningMode } from '@/lib/ai-registry/types'

export function resolveRegisteredLlmProtocol(modelKey: string): AiLlmProtocol {
  const protocol = resolveBuiltinCapabilitiesByModelKey('llm', modelKey)?.llm?.protocol
  if (protocol) return protocol
  // Bring-your-own-model providers resolve their protocol from the Manifest.
  const fallback = resolveBuiltinLlmProtocolFallbackByModelKey(modelKey)
  if (fallback) return fallback
  throw new Error(`LLM_PROTOCOL_NOT_REGISTERED:${modelKey}`)
}

export function resolveRegisteredPublicReasoningMode(modelKey: string): AiPublicReasoningMode {
  const llm = resolveBuiltinCapabilitiesByModelKey('llm', modelKey)?.llm
  if (llm?.protocol) return llm.publicReasoningMode ?? 'none'
  if (resolveBuiltinLlmProtocolFallbackByModelKey(modelKey)) return 'none'
  throw new Error(`LLM_PROTOCOL_NOT_REGISTERED:${modelKey}`)
}
