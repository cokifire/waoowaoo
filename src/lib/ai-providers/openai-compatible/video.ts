import { EXTERNAL_OPERATION } from '@/lib/external-operation/registry'
import { AppError } from '@/lib/errors/app-error'
import type { FailureRecord } from '@/lib/errors/failure'
import {
  fetchProviderWithRetry,
  readProviderJsonResponse,
} from '@/lib/ai-providers/failure'
import { createProviderAsyncTaskFailure } from '@/lib/ai-providers/shared/async-task-status'
import { requireSelectedModelId } from '@/lib/ai-providers/shared/model-selection'
import type {
  AiProviderVideoExecutionContext,
  GenerateResult,
} from '@/lib/ai-providers/runtime-types'
import { fetchWithProviderProxy } from '@/lib/http/outbound-proxy'
import {
  OPENAI_COMPATIBLE_VIDEO_SOURCE_TIMEOUT_MS,
  OPENAI_COMPATIBLE_VIDEO_STATUS_TIMEOUT_MS,
  OPENAI_COMPATIBLE_VIDEO_SUBMIT_TIMEOUT_MS,
} from './config'
import { buildOpenAICompatibleVideoExternalId } from './external-id'

const PROVIDER = 'openai-compatible'
const VIDEO_SIZE_PATTERN = /^\d{2,5}x\d{2,5}$/

type OpenAICompatibleVideoWirePayload = {
  id?: unknown
  status?: unknown
  error?: unknown
}

export type OpenAICompatibleVideoPollResult = {
  status: 'pending' | 'completed' | 'failed'
  videoUrl?: string
  resultUrl?: string
  downloadHeaders?: Record<string, string>
  failure?: FailureRecord
}

const PENDING_WIRE_STATUSES = new Set(['queued', 'pending', 'in_progress', 'processing', 'running'])
const FAILED_WIRE_STATUSES = new Set(['failed', 'error', 'cancelled', 'canceled', 'expired'])
const COMPLETED_WIRE_STATUSES = new Set(['completed', 'succeeded', 'success'])

function requireBaseUrl(raw: string | undefined, purpose: string): string {
  const normalized = typeof raw === 'string' ? raw.trim().replace(/\/+$/, '') : ''
  if (!normalized) throw new Error(`PROVIDER_BASE_URL_MISSING: ${PROVIDER} (${purpose})`)
  return normalized
}

function readWireStatus(payload: OpenAICompatibleVideoWirePayload): string {
  return typeof payload.status === 'string' ? payload.status.trim().toLowerCase() : ''
}

function readWireError(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object') return fallback
  const error = (payload as Record<string, unknown>).error
  if (typeof error === 'string' && error.trim()) return error.trim()
  if (error && typeof error === 'object') {
    const message = (error as Record<string, unknown>).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}

function readJobId(payload: OpenAICompatibleVideoWirePayload): string {
  return typeof payload.id === 'string' ? payload.id.trim() : ''
}

/**
 * The Videos API expects `seconds` as a string; the planning layer hands over a
 * whole number of seconds. Anything else is left to the endpoint to reject
 * rather than silently rounded here.
 */
function readSeconds(options: AiProviderVideoExecutionContext['options']): string | null {
  const duration = options?.duration
  return typeof duration === 'number' && Number.isInteger(duration) && duration > 0
    ? String(duration)
    : null
}

/** `size` is authoritative; a WxH `resolution` is accepted as its alias. */
function readSize(options: AiProviderVideoExecutionContext['options']): string | null {
  const candidates = [options?.size, options?.resolution]
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue
    const trimmed = candidate.trim()
    if (VIDEO_SIZE_PATTERN.test(trimmed)) return trimmed
  }
  return null
}

/** The first frame travels as the multipart `input_reference` part. */
async function readInputReference(imageUrl: string): Promise<{ blob: Blob; filename: string }> {
  let response: Response
  try {
    response = await fetchWithProviderProxy(imageUrl, {
      method: 'GET',
      signal: AbortSignal.timeout(OPENAI_COMPATIBLE_VIDEO_SOURCE_TIMEOUT_MS),
    })
  } catch {
    throw new Error('OPENAI_COMPATIBLE_VIDEO_INPUT_REFERENCE_UNREACHABLE')
  }
  if (!response.ok) {
    throw new Error(`OPENAI_COMPATIBLE_VIDEO_INPUT_REFERENCE_FETCH_FAILED:${response.status}`)
  }
  const contentType = response.headers.get('content-type')?.trim() || 'image/png'
  const extension = contentType.includes('jpeg') || contentType.includes('jpg')
    ? 'jpg'
    : contentType.includes('webp')
      ? 'webp'
      : 'png'
  return {
    blob: new Blob([await response.arrayBuffer()], { type: contentType }),
    filename: `input_reference.${extension}`,
  }
}

export async function executeOpenAICompatibleVideoGeneration(
  input: AiProviderVideoExecutionContext,
): Promise<GenerateResult> {
  const { apiKey, baseUrl } = input.providerConfig
  const normalizedBaseUrl = requireBaseUrl(baseUrl, 'video')
  if (!apiKey) {
    throw new AppError('PROVIDER_AUTH_INVALID', undefined, { provider: PROVIDER })
  }
  const modelId = requireSelectedModelId(input.selection, 'openai-compatible:video')
  const prompt = typeof input.options?.prompt === 'string' ? input.options.prompt.trim() : ''
  if (!prompt) throw new Error('OPENAI_COMPATIBLE_VIDEO_PROMPT_REQUIRED')

  const form = new FormData()
  form.set('model', modelId)
  form.set('prompt', prompt)
  const seconds = readSeconds(input.options)
  if (seconds) form.set('seconds', seconds)
  const size = readSize(input.options)
  if (size) form.set('size', size)

  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : ''
  if (imageUrl) {
    const reference = await readInputReference(imageUrl)
    form.set('input_reference', reference.blob, reference.filename)
  }

  const response = await fetchProviderWithRetry({
    url: `${normalizedBaseUrl}/videos`,
    provider: PROVIDER,
    phase: 'submit',
    options: {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      operation: EXTERNAL_OPERATION.PROVIDER_SUBMIT,
      timeoutMs: OPENAI_COMPATIBLE_VIDEO_SUBMIT_TIMEOUT_MS,
      scope: 'openai-compatible:video',
      fetchFn: fetchWithProviderProxy,
    },
  })

  const payload = await readProviderJsonResponse<OpenAICompatibleVideoWirePayload>({
    response,
    provider: PROVIDER,
    phase: 'submit',
  })
  const jobId = readJobId(payload)
  if (!jobId) throw new Error('OPENAI_COMPATIBLE_VIDEO_JOB_ID_MISSING')

  return {
    success: true,
    async: true,
    requestId: jobId,
    endpoint: 'videos',
    externalId: buildOpenAICompatibleVideoExternalId({
      providerId: input.selection.provider,
      jobId,
    }),
  }
}

export async function queryOpenAICompatibleVideoStatus(input: {
  baseUrl: string
  apiKey: string
  jobId: string
}): Promise<OpenAICompatibleVideoPollResult> {
  const baseUrl = requireBaseUrl(input.baseUrl, 'video poll')
  if (!input.apiKey) {
    throw new AppError('PROVIDER_AUTH_INVALID', undefined, { provider: PROVIDER })
  }

  const response = await fetchProviderWithRetry({
    url: `${baseUrl}/videos/${encodeURIComponent(input.jobId)}`,
    provider: PROVIDER,
    phase: 'poll',
    options: {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        Accept: 'application/json',
      },
      operation: EXTERNAL_OPERATION.PROVIDER_POLL,
      timeoutMs: OPENAI_COMPATIBLE_VIDEO_STATUS_TIMEOUT_MS,
      scope: 'openai-compatible:video',
      fetchFn: fetchWithProviderProxy,
    },
  })

  const payload = await readProviderJsonResponse<OpenAICompatibleVideoWirePayload>({
    response,
    provider: PROVIDER,
    phase: 'poll',
  })
  const status = readWireStatus(payload)
  if (PENDING_WIRE_STATUSES.has(status)) return { status: 'pending' }

  if (FAILED_WIRE_STATUSES.has(status)) {
    return {
      status: 'failed',
      failure: createProviderAsyncTaskFailure({
        provider: PROVIDER,
        code: 'EXTERNAL_ERROR',
        message: readWireError(payload, `OpenAI compatible video generation ${status}`),
        cause: payload,
      }),
    }
  }

  if (COMPLETED_WIRE_STATUSES.has(status)) {
    // The content endpoint is authenticated, so the downloader must reuse the
    // same credential; it is on the provider origin by construction.
    const contentUrl = `${baseUrl}/videos/${encodeURIComponent(input.jobId)}/content`
    return {
      status: 'completed',
      videoUrl: contentUrl,
      resultUrl: contentUrl,
      downloadHeaders: { Authorization: `Bearer ${input.apiKey}` },
    }
  }

  throw new Error(`OPENAI_COMPATIBLE_VIDEO_STATUS_UNKNOWN:${status || 'missing'}`)
}
