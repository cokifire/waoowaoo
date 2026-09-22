import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import type { ProjectProductionContext } from '@/lib/project-production-context'
import { createWaoMcpServer } from '@/lib/wao-mcp/server'

const productionContext: ProjectProductionContext = {
  schemaVersion: 8,
  version: 'test-production-version',
  fixedParameters: {},
  project: {
    projectId: 'project-1',
    name: 'Project one',
    description: null,
    videoRatio: null,
    videoResolution: '1080p',
    imageResolution: '1024',
  },
  productionCapabilities: {
    image: [],
    video: { aspectRatio: null, models: [] },
    music: [],
    voice: [],
  },
}

async function connectWaoMcpClient(): Promise<Client> {
  const server = createWaoMcpServer({
    productionContext,
    executor: {
      execute: async () => ({ structuredContent: { ok: true }, text: 'ok' }),
    },
    contextResolver: { resolve: async () => null },
  })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'wao-mcp-test', version: '0.0.0' })
  await client.connect(clientTransport)
  return client
}

describe('Wao MCP resource methods', () => {
  it('answers resources/list with an empty catalog instead of Method not found', async () => {
    const client = await connectWaoMcpClient()
    const result = await client.listResources()
    expect(result.resources).toEqual([])
  })

  it('answers resources/templates/list with an empty catalog instead of Method not found', async () => {
    const client = await connectWaoMcpClient()
    const result = await client.listResourceTemplates()
    expect(result.resourceTemplates).toEqual([])
  })

  it('answers resources/read with a resource error instead of Method not found', async () => {
    const client = await connectWaoMcpClient()
    await expect(client.readResource({ uri: 'wao://project/project-1' })).rejects.toThrow(
      /unknown resource/i,
    )
  })
})
