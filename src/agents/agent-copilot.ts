import { CopilotClient, type SessionEvent } from "@github/copilot-sdk"
import type {
  AgentConfig,
  AgentEvent,
  AgentStats,
  ErrorCode,
  RawEvent,
  RunHandle,
  RunOptions,
} from "../types"
import { subscriptionToAsyncGenerator } from "../utils/subscription"
import type { Agent } from "./agent"
import { renderMessages, runWithEvents, tryParseOutput } from "./agent"

// ============================================
// EVENT MAPPERS
// ============================================

interface RunState {
  startTime: number
  hasError: boolean
  messageId?: string
  messageContent: string
  reasoningId?: string
  reasoningContent: string
  activeTools: Map<string, string>
  stats: AgentStats
}

function createRunState(): RunState {
  return {
    startTime: Date.now(),
    hasError: false,
    messageContent: "",
    reasoningContent: "",
    activeTools: new Map(),
    stats: { tokens: {} },
  }
}

function mapCopilotEvent(event: SessionEvent, state: RunState): AgentEvent | null {
  const ts = Date.now()

  switch (event.type) {
    case "session.error":
      state.hasError = true
      return {
        type: "error",
        timestamp: ts,
        data: {
          code: "PROVIDER_ERROR" as ErrorCode,
          message: event.data.message,
          recoverable: false,
        },
      }

    case "assistant.message_delta":
      if (!state.messageId) state.messageId = event.data.messageId
      state.messageContent += event.data.deltaContent
      return {
        type: "message.delta",
        timestamp: ts,
        data: { messageId: event.data.messageId, delta: event.data.deltaContent },
      }

    case "assistant.message":
      return {
        type: "message.completed",
        timestamp: ts,
        data: { messageId: event.data.messageId, content: event.data.content },
      }

    case "assistant.reasoning_delta":
      if (!state.reasoningId) state.reasoningId = event.data.reasoningId
      state.reasoningContent += event.data.deltaContent
      return {
        type: "reasoning.delta",
        timestamp: ts,
        data: { reasoningId: event.data.reasoningId, delta: event.data.deltaContent },
      }

    case "assistant.reasoning":
      return {
        type: "reasoning.completed",
        timestamp: ts,
        data: { reasoningId: event.data.reasoningId, content: event.data.content },
      }

    case "tool.execution_start":
      if (event.data.toolName === "report_intent") {
        // skip internal intent reporting tool
        return null
      }

      state.activeTools.set(event.data.toolCallId, event.data.toolName)
      return {
        type: "tool.started",
        timestamp: ts,
        data: {
          toolId: event.data.toolCallId,
          name: event.data.toolName,
          kind: event.data.mcpServerName ? "mcp" : "builtin",
          input: event.data.arguments as Record<string, unknown> | undefined,
          mcp: event.data.mcpServerName
            ? {
                server: event.data.mcpServerName,
                tool: event.data.mcpToolName ?? event.data.toolName,
              }
            : undefined,
        },
      }

    case "tool.execution_progress":
      return {
        type: "tool.progress",
        timestamp: ts,
        data: { toolId: event.data.toolCallId, message: event.data.progressMessage },
      }

    case "tool.execution_complete": {
      const toolName = state.activeTools.get(event.data.toolCallId) ?? "unknown"

      if (toolName === "report_intent") {
        // skip internal intent reporting tool
        return null
      }

      state.activeTools.delete(event.data.toolCallId)
      return {
        type: "tool.completed",
        timestamp: ts,
        data: {
          toolId: event.data.toolCallId,
          name: toolName,
          success: event.data.success,
          output: event.data.result?.content,
          error: event.data.error?.message,
        },
      }
    }

    case "assistant.usage":
      state.stats.tokens = {
        input: event.data.inputTokens,
        output: event.data.outputTokens,
        total: (event.data.inputTokens ?? 0) + (event.data.outputTokens ?? 0),
      }
      state.stats.costUsd = event.data.cost
      state.stats.durationMs = event.data.duration
      return { type: "stats.updated", timestamp: ts, data: state.stats }

    case "session.usage_info":
      state.stats.context = {
        contextSize: event.data.tokenLimit,
        usedTokens: event.data.currentTokens,
      }
      return { type: "stats.updated", timestamp: ts, data: state.stats }

    default:
      return null
  }
}

function createErrorEvent(code: ErrorCode, message: string): AgentEvent {
  return {
    type: "error",
    timestamp: Date.now(),
    data: {
      code,
      message,
      recoverable: false,
    },
  }
}

// ============================================
// RUN HELPERS
// ============================================

function buildPrompt<T>(options: RunOptions<T>): string {
  const parts = [renderMessages(options.messages)]

  if (options?.outputSchema) {
    const schema = options.outputSchema.toJSONSchema()
    parts.push(`<message role="user">
You MUST reply a json string using the following schema:
${JSON.stringify(schema, null, 2)}

Do NOT use code blocks, DO NOT wrap the JSON in triple backticks or any markup, and DO NOT include any additional text, explanation or reasoning. Return only a single valid JSON string that conforms to the schema.
</message>`)
  }

  return parts.join("\n\n")
}

const formatParseError = (error: Error): AgentEvent =>
  createErrorEvent("PARSE_ERROR", `Failed to parse output: ${error.message}`)

// ============================================
// COPILOT AGENT
// ============================================

export function createCopilotAgent(config: AgentConfig): Agent {
  const client = new CopilotClient({
    cwd: config.cwd,
    env: config.env,
    ...(config.providerOptions as Record<string, unknown>),
  })

  function run<T = string>(options: RunOptions<T>): RunHandle<T> {
    const state = createRunState()
    const { promise, resolve, reject } = Promise.withResolvers<T>()
    const events = runSession(options, state, resolve, reject)

    return runWithEvents(events, promise, reject)
  }

  async function* runSession<T>(
    options: RunOptions<T>,
    state: RunState,
    resolve: (output: T) => void,
    reject: (error: Error) => void,
  ): AsyncGenerator<AgentEvent, void> {
    const emitRawEvents = options?.emitRawEvents ?? false

    try {
      const session = await client.createSession({
        model: config.model,
        workingDirectory: config.cwd,
        streaming: options?.streaming ?? false,
        mcpServers: config.mcpServers as Record<
          string,
          import("@github/copilot-sdk").MCPServerConfig
        >,
      })

      const prompt = buildPrompt(options)
      await session.send({ prompt })

      const events = subscriptionToAsyncGenerator<SessionEvent>({
        subscribe: (listener) => session.on(listener),
        stopWhen: (event) => event.type === "session.idle" || event.type === "session.error",
        abortSignal: options?.abortSignal,
        onAbort: () => session.abort(),
      })

      for await (const event of events) {
        if (emitRawEvents) {
          const rawEvent: RawEvent<SessionEvent> = {
            type: "raw",
            timestamp: Date.now(),
            provider: "copilot",
            data: event,
          }
          yield rawEvent
        }

        const mapped = mapCopilotEvent(event, state)
        if (mapped) {
          yield mapped
        }
      }

      state.stats.durationMs = Date.now() - state.startTime
      yield { type: "stats.updated", timestamp: Date.now(), data: state.stats }

      const result = tryParseOutput<T>(state.messageContent, options.outputSchema, formatParseError)
      if (!result.ok) {
        yield result.event
        reject(result.error)
        return
      }

      resolve(result.output)
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      yield createErrorEvent("PROVIDER_ERROR", error.message)
      reject(error)
    }
  }

  async function close(): Promise<void> {
    if (client) {
      await client.stop()
    }
  }

  return { run, close }
}
