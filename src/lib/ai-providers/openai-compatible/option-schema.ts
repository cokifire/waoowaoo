import type { AiOptionSchema, AiOptionValidationResult } from '@/lib/ai-registry/types'
import {
  buildMediaOptionSchema,
  enumValidator,
  nonEmptyStringValidator,
  type MediaModality,
} from '@/lib/ai-providers/shared/option-schema'

const IMAGE_SIZE_PATTERN = /^\d{2,5}x\d{2,5}$/

/** Video requests are text-to-video or first-frame-to-video, nothing else. */
function rejectWhenPresent(reason: string) {
  return (value: unknown): AiOptionValidationResult => (
    value === undefined ? { ok: true } : { ok: false, reason }
  )
}

/**
 * The endpoint is user-supplied, so the schema stays permissive: every standard
 * OpenAI option is forwarded when present and nothing is required.
 *
 * Reference inputs are declared-but-rejected instead of unknown: the OpenAI
 * Videos API has no place to send them, and a field-scoped "unsupported" reason
 * beats a generic "unsupported_option" for the user reading the failure.
 */
export function resolveOpenAICompatibleOptionSchema(modality: MediaModality): AiOptionSchema {
  if (modality === 'image') {
    return buildMediaOptionSchema('image', {
      excludedKeys: ['referenceImages', 'keepOriginalAspectRatio'],
      validators: {
        size: (value) => {
          if (value === undefined) return { ok: true }
          if (typeof value !== 'string') return { ok: false, reason: 'expected_string' }
          return IMAGE_SIZE_PATTERN.test(value.trim())
            ? { ok: true }
            : { ok: false, reason: 'expected_WxH' }
        },
        quality: enumValidator(['low', 'medium', 'high', 'standard', 'hd', 'auto']),
        outputFormat: enumValidator(['png', 'jpeg', 'jpg', 'webp']),
        responseFormat: enumValidator(['url', 'b64_json']),
        aspectRatio: nonEmptyStringValidator(),
        resolution: nonEmptyStringValidator(),
      },
    })
  }

  if (modality === 'video') {
    return buildMediaOptionSchema('video', {
      allowedKeys: ['referenceImages', 'referenceAudios', 'referenceVideos'],
      validators: {
        size: nonEmptyStringValidator(),
        resolution: nonEmptyStringValidator(),
        aspectRatio: nonEmptyStringValidator(),
        duration: (value) => {
          if (value === undefined) return { ok: true }
          return typeof value === 'number' && Number.isInteger(value) && value > 0
            ? { ok: true }
            : { ok: false, reason: 'expected_positive_integer_seconds' }
        },
        lastFrameImageUrl: rejectWhenPresent('unsupported_by_endpoint'),
        referenceImages: rejectWhenPresent('unsupported_by_endpoint'),
        referenceAudios: rejectWhenPresent('unsupported_by_endpoint'),
        referenceVideos: rejectWhenPresent('unsupported_by_endpoint'),
      },
    })
  }

  throw new Error(`OPENAI_COMPATIBLE_OPTION_SCHEMA_UNSUPPORTED_MODALITY:${modality}`)
}
