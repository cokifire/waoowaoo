import { afterEach, describe, expect, it, vi } from 'vitest'
import { discoverProviderModels } from '@/lib/ai-exec/provider-model-discovery'

function stubJsonResponse(status: number, payload: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('discoverProviderModels', () => {
  it('reads the OpenAI { data: [{ id }] } shape and sorts unique ids', async () => {
    const fetchMock = stubJsonResponse(200, {
      data: [{ id: 'qwen-max' }, { id: 'gpt-4o-mini' }, { id: 'qwen-max' }],
    })

    const result = await discoverProviderModels({
      baseUrl: 'https://gateway.example.com/v1/',
      apiKey: 'sk-test',
    })

    expect(result.models).toEqual(['gpt-4o-mini', 'qwen-max'])
    expect(result.total).toBe(2)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example.com/v1/models',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer sk-test' }),
      }),
    )
  })

  it('accepts a bare array of model ids and { models: [...] } wrappers', async () => {
    stubJsonResponse(200, ['b-model', 'a-model'])
    expect((await discoverProviderModels({
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
    })).models).toEqual(['a-model', 'b-model'])

    stubJsonResponse(200, { models: [{ name: 'vision-1' }] })
    expect((await discoverProviderModels({
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
    })).models).toEqual(['vision-1'])
  })

  it('rejects a missing or malformed base url', async () => {
    await expect(discoverProviderModels({ baseUrl: '', apiKey: 'sk-test' }))
      .rejects.toMatchObject({ code: 'INVALID_PARAMS' })
    await expect(discoverProviderModels({ baseUrl: 'not-a-url', apiKey: 'sk-test' }))
      .rejects.toMatchObject({ code: 'INVALID_PARAMS' })
  })

  it('rejects a missing api key before any request', async () => {
    const fetchMock = stubJsonResponse(200, { data: [] })
    await expect(discoverProviderModels({ baseUrl: 'https://gateway.example.com', apiKey: ' ' }))
      .rejects.toMatchObject({ code: 'INVALID_PARAMS' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('maps upstream auth failure to PROVIDER_AUTH_INVALID', async () => {
    stubJsonResponse(401, { error: { message: 'bad key' } })
    await expect(discoverProviderModels({ baseUrl: 'https://gateway.example.com', apiKey: 'sk-test' }))
      .rejects.toMatchObject({ code: 'PROVIDER_AUTH_INVALID' })
  })

  it('reports an endpoint without /models as unsupported', async () => {
    stubJsonResponse(404, {})
    await expect(discoverProviderModels({ baseUrl: 'https://gateway.example.com', apiKey: 'sk-test' }))
      .rejects.toMatchObject({ code: 'INVALID_PARAMS' })
  })

  it('treats an empty catalog as a failure rather than "no models to pick"', async () => {
    stubJsonResponse(200, { data: [] })
    await expect(discoverProviderModels({ baseUrl: 'https://gateway.example.com', apiKey: 'sk-test' }))
      .rejects.toMatchObject({ code: 'EXTERNAL_ERROR' })
  })
})
