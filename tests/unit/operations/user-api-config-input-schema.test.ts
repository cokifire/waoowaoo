import { describe, expect, it } from 'vitest'
import { createUserApiConfigOperations } from '@/lib/operations/domains/config/user-api-config-ops'

const putUserApiConfig = createUserApiConfigOperations()

function parseInput(input: unknown) {
  return putUserApiConfig.put_user_api_config.inputSchema.safeParse(input)
}

describe('put_user_api_config assistant model key contract', () => {
  it('accepts an Assistant model owned by a multi-instance provider', () => {
    const result = parseInput({
      defaultModels: { assistantModel: 'openai-compatible:gemini::gemini-3.6-flash' },
    })
    expect(result).toEqual({ success: true, data: expect.anything() })
  })

  it('accepts an Assistant model owned by a single-instance provider', () => {
    expect(parseInput({
      defaultModels: { assistantModel: 'openrouter::google/gemini-3.6-flash' },
    }).success).toBe(true)
  })

  it('accepts an empty string to clear the Assistant model', () => {
    expect(parseInput({ defaultModels: { assistantModel: '' } }).success).toBe(true)
  })

  it('rejects keys without the provider::modelId separator', () => {
    expect(parseInput({ defaultModels: { assistantModel: 'gemini-3.6-flash' } }).success).toBe(false)
  })

  it('rejects keys with an empty model id', () => {
    expect(parseInput({ defaultModels: { assistantModel: 'openrouter::' } }).success).toBe(false)
  })
})
