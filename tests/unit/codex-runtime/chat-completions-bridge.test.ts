import { describe, expect, it } from 'vitest'
import {
  chatCompletionToResponsesStream,
  responsesToChatCompletion,
} from '@/lib/codex-model-gateway/chat-completions-bridge'

describe('OpenAI chat-completions bridge', () => {
  it('converts Responses messages and tools into chat completions input', () => {
    const request = responsesToChatCompletion({
      model: 'deepseek-v4-flash',
      instructions: 'Be helpful.',
      input: [
        { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Draw a fox.' }] },
      ],
      tools: [{ type: 'function', name: 'create_image', description: 'Create an image', parameters: { type: 'object' } }],
    })
    expect(request).toMatchObject({
      model: 'deepseek-v4-flash', stream: true,
      messages: [
        { role: 'system', content: 'Be helpful.' },
        { role: 'user', content: 'Draw a fox.' },
      ],
      tools: [{ type: 'function', function: { name: 'create_image' } }],
    })
  })

  it('projects text and tool-call deltas into terminal Responses events', async () => {
    const source = [
      'data: {"id":"chatcmpl_1","choices":[{"delta":{"content":"Hello"}}]}\n\n',
      'data: {"id":"chatcmpl_1","choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"exec","arguments":"{\\\"x\\\":1}"}}]}}]}\n\n',
      'data: [DONE]\n\n',
    ]
    const input = new Response(new ReadableStream({
      start(controller) { source.forEach((chunk) => controller.enqueue(new TextEncoder().encode(chunk))); controller.close() },
    }), { headers: { 'Content-Type': 'text/event-stream' } })
    const body = await chatCompletionToResponsesStream(input, 'deepseek-v4-flash').text()
    expect(body).toContain('event: response.output_text.delta')
    expect(body).toContain('"delta":"Hello"')
    expect(body).toContain('event: response.function_call_arguments.done')
    expect(body).toContain('event: response.completed')
  })
})
