type Json = Record<string, unknown>

function record(value: unknown): value is Json {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function responseEvent(type: string, response: Json, extra: Json = {}): Uint8Array {
  return new TextEncoder().encode(`event: ${type}\ndata: ${JSON.stringify({ type, response, ...extra })}\n\n`)
}

function messageContent(value: unknown): string {
  if (typeof value === 'string') return value
  if (!Array.isArray(value)) return ''
  return value.map((part) => record(part) ? text(part.text) : '').filter(Boolean).join('\n')
}

/** Converts the subset of Responses emitted by Codex into OpenAI chat input. */
export function responsesToChatCompletion(body: Json): Json {
  const messages: Json[] = []
  const instructions = text(body.instructions)
  if (instructions) messages.push({ role: 'system', content: instructions })
  const pendingCalls = new Map<string, Json>()
  for (const raw of Array.isArray(body.input) ? body.input : []) {
    if (!record(raw)) continue
    if (raw.type === 'function_call') {
      const id = text(raw.call_id) || text(raw.id)
      if (id) pendingCalls.set(id, { id, type: 'function', function: { name: text(raw.name), arguments: text(raw.arguments) || '{}' } })
      continue
    }
    if (raw.type === 'function_call_output') {
      const id = text(raw.call_id)
      const call = pendingCalls.get(id)
      if (call) messages.push({ role: 'assistant', content: null, tool_calls: [call] })
      pendingCalls.delete(id)
      messages.push({ role: 'tool', tool_call_id: id, content: messageContent(raw.output) || text(raw.output) })
      continue
    }
    if (raw.type !== 'message') continue
    const role = raw.role === 'developer' ? 'system' : raw.role
    if (role === 'system' || role === 'user' || role === 'assistant') {
      messages.push({ role, content: messageContent(raw.content) })
    }
  }
  for (const call of pendingCalls.values()) messages.push({ role: 'assistant', content: null, tool_calls: [call] })
  const tools = Array.isArray(body.tools) ? body.tools.flatMap((raw) => {
    if (!record(raw) || typeof raw.name !== 'string') return []
    const schema = record(raw.parameters) ? raw.parameters : { type: 'object', additionalProperties: true }
    return [{ type: 'function', function: { name: raw.name, description: text(raw.description), parameters: schema } }]
  }) : []
  return { model: body.model, messages, ...(tools.length ? { tools, tool_choice: 'auto' } : {}), stream: true, stream_options: { include_usage: true } }
}

function baseResponse(id: string, model: string): Json {
  return { id, object: 'response', created_at: Math.floor(Date.now() / 1000), status: 'in_progress', model, output: [], error: null, incomplete_details: null, usage: null, metadata: {} }
}

/** Re-emits chat-completions chunks as the Responses SSE vocabulary used by Codex. */
export function chatCompletionToResponsesStream(response: Response, model: string): Response {
  if (!response.body) throw new Error('CHAT_COMPLETION_STREAM_BODY_MISSING')
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let id = 'resp_wao_chat_bridge'
  let created = false
  let textItem = false
  const calls = new Map<number, { id: string; name: string; arguments: string; item: Json }>()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (type: string, res: Json, extra?: Json) => controller.enqueue(responseEvent(type, res, extra))
      const current = () => baseResponse(id, model)
      const ensureCreated = () => {
        if (created) return
        created = true
        const res = current(); emit('response.created', res)
      }
      const emitTextStart = () => {
        if (textItem) return
        textItem = true
        const res = current(); const item = { id: 'msg_wao_chat_bridge', type: 'message', role: 'assistant', status: 'in_progress', content: [] }
        emit('response.output_item.added', res, { output_index: 0, item })
        emit('response.content_part.added', res, { output_index: 0, content_index: 0, part: { type: 'output_text', text: '' } })
      }
      const consume = (payload: Json) => {
        const choice = Array.isArray(payload.choices) && record(payload.choices[0]) ? payload.choices[0] : null
        if (!choice) return
        ensureCreated()
        const delta = record(choice.delta) ? choice.delta : {}
        const content = text(delta.content)
        if (content) { emitTextStart(); emit('response.output_text.delta', current(), { output_index: 0, content_index: 0, delta: content }) }
        if (Array.isArray(delta.tool_calls)) for (const raw of delta.tool_calls) {
          if (!record(raw) || typeof raw.index !== 'number') continue
          const fn = record(raw.function) ? raw.function : {}
          let call = calls.get(raw.index)
          if (!call) {
            const callId = text(raw.id) || `call_wao_${raw.index}`
            const item = { id: callId, type: 'function_call', status: 'in_progress', call_id: callId, name: text(fn.name), arguments: '' }
            call = { id: callId, name: text(fn.name), arguments: '', item }; calls.set(raw.index, call)
            emit('response.output_item.added', current(), { output_index: calls.size, item })
          }
          const part = text(fn.arguments)
          if (part) { call.arguments += part; emit('response.function_call_arguments.delta', current(), { output_index: raw.index + 1, item_id: call.id, delta: part }) }
        }
      }
      try {
        while (true) {
          const next = await reader.read()
          buffer += decoder.decode(next.value, { stream: !next.done })
          const frames = buffer.split(/\r?\n\r?\n/u); buffer = frames.pop() ?? ''
          for (const frame of frames) {
            const data = frame.split(/\r?\n/u).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim()).join('\n')
            if (data && data !== '[DONE]') { try { const parsed: unknown = JSON.parse(data); if (record(parsed)) { const nextId = text(parsed.id); if (nextId) id = nextId; consume(parsed) } } catch {} }
          }
          if (next.done) break
        }
        ensureCreated()
        const final = current()
        if (textItem) { emit('response.output_text.done', final, { output_index: 0, content_index: 0, text: '' }); emit('response.content_part.done', final, { output_index: 0, content_index: 0, part: { type: 'output_text', text: '' } }); emit('response.output_item.done', final, { output_index: 0, item: { id: 'msg_wao_chat_bridge', type: 'message', role: 'assistant', status: 'completed', content: [] } }) }
        for (const [index, call] of calls) { emit('response.function_call_arguments.done', final, { output_index: index + 1, item_id: call.id, arguments: call.arguments }); emit('response.output_item.done', final, { output_index: index + 1, item: { ...call.item, status: 'completed', arguments: call.arguments } }) }
        final.status = 'completed'; emit('response.completed', final); controller.close()
      } catch (error) { controller.error(error) }
    },
    cancel(reason) { return reader.cancel(reason) },
  })
  return new Response(stream, { status: response.status, headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } })
}
