import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { ensureAiCatalogsRegistered } from '@/lib/ai-exec/catalog-bootstrap'
import { listApiConfigCatalogProviders } from '@/lib/ai-registry/api-config-catalog'
import { resolveAiProviderManifest } from '@/lib/ai-providers/manifests'
import { openaiCompatibleAdapter } from '@/lib/ai-providers/openai-compatible/adapter'
import {
  buildOpenAICompatibleVideoExternalId,
  parseOpenAICompatibleExternalId,
} from '@/lib/ai-providers/openai-compatible/external-id'
import { openAICompatibleAsyncTaskProvider } from '@/lib/ai-providers/openai-compatible/async-task'
import { resolveOpenAICompatibleOptionSchema } from '@/lib/ai-providers/openai-compatible/option-schema'
import {
  executeOpenAICompatibleVideoGeneration,
  queryOpenAICompatibleVideoStatus,
} from '@/lib/ai-providers/openai-compatible/video'
import {
  resolveAsyncTaskProviderByExternalId,
} from '@/lib/ai-providers'
import { normalizeAiOptions } from '@/lib/ai-exec/normalize'

beforeAll(() => {
  ensureAiCatalogsRegistered()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function stubJsonResponse(status: number, payload: unknown) {
  const fetchMock = vi.fn(async () => new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const VIDEO_SELECTION = {
  provider: 'openai-compatible:my-gateway',
  modelId: 'sora-2',
  modelKey: 'openai-compatible:my-gateway::sora-2',
  variantSubKind: 'official' as const,
}

describe('openai-compatible video contract', () => {
  it('declares video alongside llm and image', () => {
    const manifest = resolveAiProviderManifest('openai-compatible')
    expect(manifest.apiConfig?.supportedModelTypes).toEqual(['llm', 'image', 'video'])
    expect(openaiCompatibleAdapter.video).toBeDefined()
    expect(openaiCompatibleAdapter.video?.describe(VIDEO_SELECTION).execution.mode).toBe('async')
    expect(manifest.asyncTasks?.map((task) => task.providerCode)).toEqual(['OPENAI_COMPATIBLE'])
    expect(manifest.mediaInputs?.map((input) => input.modality)).toContain('video')
  })

  it('offers the video slot in the API config catalog', () => {
    const provider = listApiConfigCatalogProviders()
      .find((candidate) => candidate.id === 'openai-compatible')
    expect(provider?.modelTypes).toEqual(['llm', 'image', 'video'])
  })

  it('keeps the provider instance inside the async external id', () => {
    const externalId = buildOpenAICompatibleVideoExternalId({
      providerId: 'openai-compatible:my-gateway',
      jobId: 'video_abc:1',
    })
    expect(externalId.startsWith('OPENAI_COMPATIBLE:VIDEO:')).toBe(true)
    const parsed = parseOpenAICompatibleExternalId(externalId)
    expect(parsed.providerId).toBe('openai-compatible:my-gateway')
    expect(parsed.requestId).toBe('video_abc:1')
    expect(resolveAsyncTaskProviderByExternalId(externalId)).toBe(openAICompatibleAsyncTaskProvider)
  })

  it('rejects reference inputs the Videos API cannot carry', () => {
    const schema = resolveOpenAICompatibleOptionSchema('video')
    const accepted = normalizeAiOptions({
      schema,
      context: 'video:test',
      options: { prompt: 'a cat', duration: 8, size: '1280x720' },
    })
    expect(accepted).toMatchObject({ duration: 8, size: '1280x720' })

    expect(() => normalizeAiOptions({
      schema,
      context: 'video:test',
      options: { prompt: 'a cat', referenceImages: ['https://example.com/a.png'] },
    })).toThrow(/invalid_option/)
    expect(() => normalizeAiOptions({
      schema,
      context: 'video:test',
      options: { prompt: 'a cat', lastFrameImageUrl: 'https://example.com/b.png' },
    })).toThrow(/invalid_option/)
  })
})

describe('openai-compatible video wire calls', () => {
  const context = {
    userId: 'user-1',
    providerConfig: { id: 'openai-compatible:my-gateway', name: 'My Gateway', apiKey: 'sk-test', baseUrl: 'https://gateway.example.com/v1' },
    selection: VIDEO_SELECTION,
    imageUrl: '',
    options: { prompt: 'a cat walking', duration: 8, size: '1280x720' },
  }

  it('submits a multipart job and returns an async handle', async () => {
    const fetchMock = stubJsonResponse(200, { id: 'video_1', status: 'queued' })

    const result = await executeOpenAICompatibleVideoGeneration(context)

    expect(result).toMatchObject({
      success: true,
      async: true,
      requestId: 'video_1',
      endpoint: 'videos',
      externalId: buildOpenAICompatibleVideoExternalId({
        providerId: 'openai-compatible:my-gateway',
        jobId: 'video_1',
      }),
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://gateway.example.com/v1/videos')
    expect(init.method).toBe('POST')
    const form = init.body as FormData
    expect(form.get('model')).toBe('sora-2')
    expect(form.get('prompt')).toBe('a cat walking')
    expect(form.get('seconds')).toBe('8')
    expect(form.get('size')).toBe('1280x720')
    expect(form.get('input_reference')).toBeNull()
  })

  it('maps the polling status and hands back an authenticated content url', async () => {
    stubJsonResponse(200, { id: 'video_1', status: 'in_progress' })
    expect(await queryOpenAICompatibleVideoStatus({
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
      jobId: 'video_1',
    })).toEqual({ status: 'pending' })

    stubJsonResponse(200, { id: 'video_1', status: 'completed' })
    expect(await queryOpenAICompatibleVideoStatus({
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
      jobId: 'video_1',
    })).toEqual({
      status: 'completed',
      videoUrl: 'https://gateway.example.com/v1/videos/video_1/content',
      resultUrl: 'https://gateway.example.com/v1/videos/video_1/content',
      downloadHeaders: { Authorization: 'Bearer sk-test' },
    })

    stubJsonResponse(200, { id: 'video_1', status: 'failed', error: { message: 'boom' } })
    const failed = await queryOpenAICompatibleVideoStatus({
      baseUrl: 'https://gateway.example.com/v1',
      apiKey: 'sk-test',
      jobId: 'video_1',
    })
    expect(failed.status).toBe('failed')
    expect(failed.failure?.interpretation.code).toBe('EXTERNAL_ERROR')
    expect(JSON.stringify(failed.failure)).toContain('boom')
  })

  it('requires a base url before any request', async () => {
    const fetchMock = stubJsonResponse(200, {})
    await expect(queryOpenAICompatibleVideoStatus({
      baseUrl: '',
      apiKey: 'sk-test',
      jobId: 'video_1',
    })).rejects.toThrow(/PROVIDER_BASE_URL_MISSING/)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
