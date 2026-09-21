/**
 * Providers whose available models can be listed from an OpenAI-shaped
 * `GET {baseUrl}/models` endpoint.
 *
 * Leaf module on purpose: both the API config catalog (to decide whether the
 * UI offers model detection) and the discovery implementation read it, and
 * neither may import the other.
 */
export const MODEL_DISCOVERY_PROVIDER_KEYS: readonly string[] = [
  'openai-compatible',
  'openrouter',
]

export function supportsModelDiscovery(providerKey: string): boolean {
  return MODEL_DISCOVERY_PROVIDER_KEYS.includes(providerKey.trim().toLowerCase())
}
