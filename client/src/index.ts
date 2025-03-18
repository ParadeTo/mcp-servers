import {EventSource} from 'eventsource'
global.EventSource = EventSource
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {SSEClientTransport} from '@modelcontextprotocol/sdk/client/sse.js'
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js'
import {Transport} from '@modelcontextprotocol/sdk/shared/transport.js'
import {Tool} from '@modelcontextprotocol/sdk/types.js'
import {log} from 'console'
export class MCPClient {
  private client: Client
  private tools: Tool[] = []

  constructor() {
    this.client = new Client(
      {
        name: 'mcp-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          prompts: {},
          resources: {},
          tools: {},
        },
      }
    )
  }

  async connect(type: 'stdio' | 'http') {
    let transport: Transport
    if (type === 'stdio') {
      transport = new StdioClientTransport({
        command: 'node',
        args: ['/Users/youxingzhi/ayou/mcp-servers/sentry/build/index.js'],
      })
    } else {
      transport = new SSEClientTransport(new URL('http://localhost:3000/sse'))
    }

    await this.client.connect(transport)
    await this.loadTools()
  }

  private async loadTools() {
    const response = await this.client.listTools()
    this.tools = response.tools
  }

  async callTool(name: string, args: Record<string, any>) {
    const tool = this.tools.find((t) => t.name === name)
    if (!tool) {
      throw new Error(`Tool ${name} not found`)
    }
    return await this.client.callTool({name, arguments: args})
  }

  async getSentryIssue(issueIdOrUrl: string) {
    return await this.callTool('get_sentry_issue', {
      issue_id_or_url: issueIdOrUrl,
    })
  }
}

const client = new MCPClient()

client.connect('http').then(async () => {
  const issue = await client.getSentryIssue('4')
  console.log(issue)
})
