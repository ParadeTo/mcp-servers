import {
  GetPromptResultSchema,
  PromptMessageSchema,
  TextContentSchema,
} from '@modelcontextprotocol/sdk/types.js'

interface Frame {
  filename?: string
  lineNo?: number
  function?: string
  context?: [number, string][]
}

interface Exception {
  type?: string
  value?: string
  stacktrace?: {
    frames?: Frame[]
  }
}

interface Entry {
  type: string
  data: {
    values: Exception[]
  }
}

interface SentryEvent {
  entries?: Entry[]
}

export function createStacktrace(latestEvent: SentryEvent): string {
  const stacktraces: string[] = []

  for (const entry of latestEvent.entries || []) {
    if (entry.type !== 'exception') {
      continue
    }

    const exceptionData = entry.data.values
    for (const exception of exceptionData) {
      const exceptionType = exception.type || 'Unknown'
      const exceptionValue = exception.value || ''
      const stacktrace = exception.stacktrace

      let stacktraceText = `Exception: ${exceptionType}: ${exceptionValue}\n\n`

      if (stacktrace) {
        stacktraceText += 'Stacktrace:\n'
        for (const frame of stacktrace.frames || []) {
          const filename = frame.filename || 'Unknown'
          const lineno = frame.lineNo?.toString() || '?'
          const functionName = frame.function || 'Unknown'

          stacktraceText += `${filename}:${lineno} in ${functionName}\n`

          if (frame.context) {
            for (const [_, line] of frame.context) {
              stacktraceText += `    ${line}\n`
            }
          }

          stacktraceText += '\n'
        }
      }

      stacktraces.push(stacktraceText)
    }
  }

  return stacktraces.length > 0 ? stacktraces.join('\n') : 'No stacktrace found'
}

interface SentryIssueDataOption {
  title: string
  issueId: string
  status: string
  level: string
  firstSeen: string
  lastSeen: string
  count: number
  stacktrace: string
}

export class SentryIssueData {
  private option: SentryIssueDataOption | null = null
  constructor(option: SentryIssueDataOption) {
    this.option = option
  }

  toText() {
    return (
      `Sentry Issue: ${this.option?.title}\n\n` +
      `Issue ID: ${this.option?.issueId}\n` +
      `Status: ${this.option?.status}\n` +
      `Level: ${this.option?.level}\n` +
      `First Seen: ${this.option?.firstSeen}\n` +
      `Last Seen:${this.option?.lastSeen}\n` +
      `Count: ${this.option?.count}\n` +
      this.option?.stacktrace
    )
  }

  toToolResult() {
    return TextContentSchema.parse({
      type: 'text',
      text: this.toText(),
    })
  }

  toPromotResult() {
    return GetPromptResultSchema.parse({
      description: `Sentry Issue: ${this.option?.title}`,
      messages: [
        PromptMessageSchema.parse({
          role: 'user',
          content: TextContentSchema.parse({
            type: 'text',
            text: this.toText(),
          }),
        }),
      ],
    })
  }
}
