import http from 'http'
import url, {URL} from 'url'
import {Server} from '@modelcontextprotocol/sdk/server/index.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js'
import axios, {AxiosInstance} from 'axios'
import {createStacktrace, SentryIssueData} from './utils.js'
import {SSEServerTransport} from '@modelcontextprotocol/sdk/server/sse.js'

const sentryBaseUrl =
  process.env.SENTRY_BASE_URL || 'https://dpsentry.shopee.io/api/0/'
const sentryApiKey =
  process.env.SENTRY_API_KEY ||
  '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'

export class SentryServer {
  private server: Server
  private axiosInstance: AxiosInstance | null = null
  private sessionMap: Map<string, SSEServerTransport> = new Map()

  constructor() {
    this.server = new Server(
      {name: 'mcp-server-sentry', version: '1.0.0'},
      {capabilities: {tools: {}}}
    )
    this
    this.setupToolHandlers()
  }

  initAxios(baseURL: string, apiKey: string) {
    this.axiosInstance = axios.create({
      baseURL: baseURL,
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    })
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
    if (!this.axiosInstance) {
      throw new McpError(ErrorCode.InternalError, 'No axios instance')
    }
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

  async runStdio(sentryBaseUrl: string, sentryApiKey: string) {
    const transport = new StdioServerTransport()
    this.initAxios(sentryBaseUrl, sentryApiKey)
    await this.server.connect(transport)
    console.error('SentryServer running on stdio')
  }

  async runSse(port: number) {
    const server = http.createServer(async (req, res) => {
      if (!req.url) {
        res.writeHead(400, {'Content-Type': 'text/plain'})
        res.end('Bad Request: URL is missing')
        return
      }
      const url = new URL(req.url, `http://${req.headers.host}`)
      if (url.pathname === '/sse') {
        console.log(req.url)
        const sentryBaseUrl = url.searchParams.get('sentry_base_url')
        const sentryApiKey = url.searchParams.get('sentry_api_key')

        if (!sentryBaseUrl || !sentryApiKey) {
          res.writeHead(400, {'Content-Type': 'text/plain'})
          res.end('sentry_base_url and sentry_api_key are required')
          return
        }

        const transport = new SSEServerTransport('/messages', res)
        this.initAxios(sentryBaseUrl, sentryApiKey)
        const sessionId = transport.sessionId
        this.sessionMap.set(sessionId, transport)
        await this.server.connect(transport)
      } else if (url.pathname === '/messages') {
        const sessionId = url.searchParams.get('sessionId')
        const transport = this.sessionMap.get(sessionId!)
        await transport?.handlePostMessage(req, res)
      }
    })
    server.listen(port, () => {
      console.error(`SentryServer running on http://localhost:${port}`)
    })
  }
}
