/**
 * Bring-your-own-endpoint provider: there is no canonical base URL, the user
 * supplies one per provider instance. Only the connection probe needs a model
 * id fallback.
 */
export const OPENAI_COMPATIBLE_PROVIDER_TEST_LLM_MODEL_ID = 'gpt-4o-mini'

export const OPENAI_COMPATIBLE_IMAGE_TIMEOUT_MS = 60 * 1000

/**
 * The official OpenAI Videos API is asynchronous: submit, then poll until the
 * job reports a terminal status. Both calls are short; the wait is the queue's.
 */
export const OPENAI_COMPATIBLE_VIDEO_SUBMIT_TIMEOUT_MS = 60 * 1000
export const OPENAI_COMPATIBLE_VIDEO_STATUS_TIMEOUT_MS = 30 * 1000
/** Reading the first frame to attach as `input_reference`. */
export const OPENAI_COMPATIBLE_VIDEO_SOURCE_TIMEOUT_MS = 30 * 1000
