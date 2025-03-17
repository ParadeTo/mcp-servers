import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import axios, {Axios} from 'axios'
import {createStacktrace, SentryIssueData} from './utils.js'

const sentryBaseUrl =
  process.env.SENTRY_BASE_URL || 'https://dpsentry.shopee.io/api/0/'
const sentryApiKey =
  process.env.SENTRY_API_KEY ||
  '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'

class SentryServer {
  private server: Server
  private axiosInstance: Axios

  constructor() {
    this.server = new Server(
      {name: 'mcp-server-sentry', version: '1.0.0'},
      {capabilities: {tools: {}}}
    )

    this.axiosInstance = axios.create({
      baseURL: sentryBaseUrl,
      headers: {
        Authorization: `Bearer ${sentryApiKey}`,
      },
    })

    this.setupToolHandlers()
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_sentry_issue',
            description: `Retrieve and analyze a Sentry issue by ID or URL. Use this tool when you need to:
                - Investigate production errors and crashes
                - Access detailed stacktraces from Sentry
                - Analyze error patterns and frequencies
                - Get information about when issues first/last occurred
                - Review error counts and status`,
            inputSchema: {
              type: 'object',
              properties: {
                issue_id_or_url: {
                  type: 'string',
                  description: 'Sentry issue ID or URL to analyze',
                },
              },
              required: ['issue_id_or_url'],
            },
          },
        ],
      }
    })

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'get_sentry_issue') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Tool ${request.params.name} not found`
        )
      }

      if (
        !request.params.arguments ||
        !request.params.arguments.issue_id_or_url
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Missing required argument: issue_id_or_url'
        )
      }

      const issueData = await this.handleSentryIssue(
        request.params.arguments.issue_id_or_url as string
      )
      // return issueData.toToolResult()
      return {
        content: [issueData.toToolResult()],
        isError: false,
      }
    })
  }

  async handleSentryIssue(issueIdOrUrl: string) {
    try {
      const rsp = await this.axiosInstance.get(`/issues/${issueIdOrUrl}/`)
      const issue_data = rsp.data
      const hashes_response = await this.axiosInstance.get(
        `/issues/${issueIdOrUrl}/hashes/`
      )
      const hashes = hashes_response.data
      const latest_event = hashes[0]['latestEvent']
      const stacktrace = createStacktrace(latest_event)
      return new SentryIssueData({
        issueId: issue_data['id'],
        title: issue_data['title'],
        status: issue_data['status'],
        count: issue_data['count'],
        firstSeen: issue_data['firstSeen'],
        lastSeen: issue_data['lastSeen'],
        level: issue_data['level'],
        stacktrace: stacktrace,
      })
    } catch (error: unknown) {
      throw new McpError(ErrorCode.InternalError, (error as Error).message)
    }
  }

  async run() {
    const transport = new StdioServerTransport()
    await this.server.connect(transport)
    console.error('SentryServer running on stdio')
  }
}

const server = new SentryServer()
server.run()
