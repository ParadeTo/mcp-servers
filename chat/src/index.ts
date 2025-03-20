import {MCPClient} from './client.js'
import OpenAI from 'openai'
import {AIMessage, HumanMessage, SystemMessage} from '@langchain/core/messages'
import {log} from 'node:console'
import {Tool} from '@modelcontextprotocol/sdk/types.js'
import {ChatCompletionMessageParam} from 'openai/resources.mjs'
import {APIClient} from 'openai/core.mjs'
import prompt from 'prompt'

export async function run() {
  //@ts-ignore
  const openai = new OpenAI({
    baseURL: 'https://api.302.ai/v1',
    apiKey: 'sk-nxAAM0KLMqCEdlMHZpRI6yaqDJteX0PLBu1UcqLRpUSZhCfC',
  })

  const messages = [
    new SystemMessage('Translate the following from English into Chinese'),
    new HumanMessage('hi!'),
  ]

  const result = openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4096,
    stream: false,
    messages: [
      {
        role: 'system',
        content: 'Translate the following from English into Chinese',
      },
      {
        role: 'user',
        content: 'hi!',
      },
    ],
  })

  const a = await result
  console.log('------', JSON.stringify(a))
  // for await (const part of await result) {
  //   console.log('------', JSON.stringify(part))
  // }
}

// run()

class Chatbox {
  //@ts-ignore
  openai: OpenAI
  mcpClient: MCPClient
  model = 'gpt-4o'
  constructor() {
    //@ts-ignore
    this.openai = new OpenAI({
      baseURL: 'https://api.302.ai/v1',
      apiKey: 'sk-nxAAM0KLMqCEdlMHZpRI6yaqDJteX0PLBu1UcqLRpUSZhCfC',
    })
    this.mcpClient = new MCPClient()
  }

  async initMcp() {
    await this.mcpClient.connect('stdio')
  }

  getSystemPrompt(tools: Tool[]) {
    const toolsStr = JSON.stringify(tools)
    // tools.reduce((acc, tool) => {
    //   return acc + `${JSON.stringify(tool)}\n`
    // }, '')
    return `You are a helpful assistant capable of accessing external functions and engaging in casual chat. Use the responses from these function calls to provide accurate and informative answers. The answers should be natural and hide the fact that you are using tools to access real-time information. Guide the user about available tools and their capabilities. Always utilize tools to access real-time information when required. Engage in a friendly manner to enhance the chat experience.
 
# Tools
 
${toolsStr}
 
# Notes 
 
- Ensure responses are based on the latest information available from function calls.
- Maintain an engaging, supportive, and friendly tone throughout the dialogue.
- Always highlight the potential of available tools to assist users comprehensively.`
  }

  async agentLoop(
    query: string,
    tools: Tool[],
    messages: ChatCompletionMessageParam[]
  ) {
    if (messages.length === 0) {
      messages = [{role: 'system', content: this.getSystemPrompt(tools)}]
    }
    messages.push({role: 'user', content: query})
    console.log('-------messages------', messages)
    const result = await this.openai.chat.completions.create({
      model: this.model,
      max_tokens: 4096,
      stream: false,
      messages: messages,
    })
    console.log('----result------', JSON.stringify(result))
    let new_response
    const stopReason = result.choices[0].message.tool_calls
      ? 'tool_call'
      : result.choices[0]?.finish_reason
    if (stopReason === 'tool_call') {
      for (const toolCall of result.choices[0]?.message?.tool_calls!) {
        const toolResult = this.mcpClient.callTool(
          toolCall.function?.name!,
          JSON.parse(toolCall.function?.arguments!)
        )
        messages.push({
          role: 'tool',
          content: JSON.stringify(toolResult),
          tool_call_id: toolCall.id!,
        })
      }
      new_response = await this.openai.chat.completions.create({
        model: this.model,
        max_tokens: 4096,
        stream: false,
        messages: messages,
      })
    } else if (stopReason === 'stop') {
      new_response = result
    } else {
      throw new Error(`Unknown stop reason: ${stopReason}`)
    }
    messages.push({
      role: 'assistant',
      content: new_response.choices[0].message?.content,
    })
    return {
      response: new_response.choices[0].message?.content,
      messages: messages,
    }
  }

  async getUserInput(): Promise<string> {
    return new Promise((resolve, reject) => {
      prompt.get(['question'], (err, result) => {
        if (err) {
          reject(err)
        } else {
          //@ts-ignore
          resolve(result.question)
        }
      })
    })
  }

  main = async () => {
    let messages: ChatCompletionMessageParam[] = []
    prompt.start()
    const tools = await this.mcpClient.getTools()
    while (true) {
      const question = await this.getUserInput()
      const result = await this.agentLoop(question, tools, messages)
      messages = result.messages
      console.log('Answer:', result.response)
    }
  }
}

const chatBox = new Chatbox()
chatBox.initMcp().then(async () => {
  chatBox.main()
})
