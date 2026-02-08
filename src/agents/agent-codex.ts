import {
  Codex,
  type ThreadOptions as CodexThreadOptions,
  type TurnOptions as CodexTurnOptions,
  type McpToolCallItem,
  type ThreadEvent,
  type ThreadItem,
  type Usage,
} from "@openai/codex-sdk"
import { renderMessages, runWithEvents, tryParseOutput } from "./agent-utils.ts"
import type {
  Agent,
  AgentConfig,
  AgentEvent,
  AgentStats,
  ErrorCode,
  RawEvent,
  RunHandle,
  RunOptions,
} from "./types.ts"

interface ToolState {
  name: string
  kind: "builtin" | "mcp"
  lastOutput: string
}

interface RunState {
  startTime: number
  hasError: boolean
  lastErrorMessage?: string
  messageContent: string
  reasoningContent: string
  messagesById: Map<string, string>
  reasoningById: Map<string, string>
  tools: Map<string, ToolState>
  stats: AgentStats
}

function createRunState(): RunState {
  return {
    startTime: Date.now(),
    hasError: false,
    lastErrorMessage: undefined,
    messageContent: "",
    reasoningContent: "",
    messagesById: new Map(),
    reasoningById: new Map(),
    tools: new Map(),
    stats: { tokens: {} },
  }
}

function createErrorEvent(code: ErrorCode, message: string, recoverable = false): AgentEvent {
  return {
    type: "error",
    timestamp: Date.now(),
    data: { code, message, recoverable },
  }
}

function mapUsageToStats(usage: Usage, state: RunState): AgentEvent {
  const input = usage.input_tokens + usage.cached_input_tokens
  const output = usage.output_tokens
  state.stats.tokens = {
    input,
    output,
    total: input + output,
  }
  return { type: "stats.updated", timestamp: Date.now(), data: state.stats }
}

function computeDelta(id: string, text: string, store: Map<string, string>): string {
  const previous = store.get(id) ?? ""
  const delta = text.slice(previous.length)
  store.set(id, text)
  return delta
}

function mapAgentMessage(
  item: Extract<ThreadItem, { type: "agent_message" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const events: AgentEvent[] = []
  const ts = Date.now()
  const delta = computeDelta(item.id, item.text, state.messagesById)

  if (delta) {
    state.messageContent = item.text
    events.push({
      type: "message.delta",
      timestamp: ts,
      data: { messageId: item.id, delta },
    })
  }

  if (phase === "item.completed") {
    state.messageContent = item.text
    events.push({
      type: "message.completed",
      timestamp: ts,
      data: { messageId: item.id, content: item.text },
    })
  }

  return events
}

function mapReasoning(
  item: Extract<ThreadItem, { type: "reasoning" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const events: AgentEvent[] = []
  const ts = Date.now()
  const delta = computeDelta(item.id, item.text, state.reasoningById)

  if (delta) {
    state.reasoningContent = item.text
    events.push({
      type: "reasoning.delta",
      timestamp: ts,
      data: { reasoningId: item.id, delta },
    })
  }

  if (phase === "item.completed") {
    state.reasoningContent = item.text
    events.push({
      type: "reasoning.completed",
      timestamp: ts,
      data: { reasoningId: item.id, content: item.text },
    })
  }

  return events
}

function mapCommandExecution(
  item: Extract<ThreadItem, { type: "command_execution" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const events: AgentEvent[] = []
  const ts = Date.now()
  const existing = state.tools.get(item.id) ?? {
    name: item.command,
    kind: "builtin" as const,
    lastOutput: "",
  }

  if (!state.tools.has(item.id)) {
    state.tools.set(item.id, existing)
    state.stats.toolCalls = (state.stats.toolCalls ?? 0) + 1
    events.push(
      {
        type: "tool.started",
        timestamp: ts,
        data: {
          toolId: item.id,
          name: existing.name,
          kind: "builtin",
          input: { command: item.command },
        },
      },
      { type: "stats.updated", timestamp: ts, data: state.stats },
    )
  }

  const output = item.aggregated_output ?? ""
  if (phase === "item.updated" || phase === "item.completed") {
    const delta = output.slice(existing.lastOutput.length)
    if (delta) {
      existing.lastOutput = output
      events.push({
        type: "tool.progress",
        timestamp: ts,
        data: { toolId: item.id, message: delta },
      })
    }
  }

  if (phase === "item.completed") {
    const success = item.status === "completed"
    const error =
      success || item.exit_code === undefined
        ? success
          ? undefined
          : "Command failed"
        : `Command failed (exit code ${item.exit_code})`

    state.tools.delete(item.id)
    events.push({
      type: "tool.completed",
      timestamp: ts,
      data: {
        toolId: item.id,
        name: existing.name,
        success,
        output: output || undefined,
        error,
      },
    })
  }

  return events
}

function serializeMcpResult(item: McpToolCallItem): string | undefined {
  if (item.result?.structured_content) {
    return JSON.stringify(item.result.structured_content)
  }
  if (item.result?.content) {
    return JSON.stringify(item.result.content)
  }
  return undefined
}

function mapMcpToolCall(
  item: Extract<ThreadItem, { type: "mcp_tool_call" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const events: AgentEvent[] = []
  const ts = Date.now()
  const existing = state.tools.get(item.id) ?? {
    name: item.tool,
    kind: "mcp" as const,
    lastOutput: "",
  }

  if (!state.tools.has(item.id)) {
    state.tools.set(item.id, existing)
    state.stats.toolCalls = (state.stats.toolCalls ?? 0) + 1
    events.push(
      {
        type: "tool.started",
        timestamp: ts,
        data: {
          toolId: item.id,
          name: item.tool,
          kind: "mcp",
          input: item.arguments as Record<string, unknown>,
          mcp: { server: item.server, tool: item.tool },
        },
      },
      { type: "stats.updated", timestamp: ts, data: state.stats },
    )
  }

  if (phase === "item.completed") {
    const success = item.status === "completed"
    state.tools.delete(item.id)
    events.push({
      type: "tool.completed",
      timestamp: ts,
      data: {
        toolId: item.id,
        name: item.tool,
        success,
        output: success ? serializeMcpResult(item) : undefined,
        error: success ? undefined : item.error?.message,
      },
    })
  }

  return events
}

function mapFileChange(item: Extract<ThreadItem, { type: "file_change" }>): AgentEvent[] {
  if (item.status === "failed") {
    return [createErrorEvent("PROVIDER_ERROR", "File change failed", true)]
  }

  return [
    {
      type: "file.changed",
      timestamp: Date.now(),
      data: {
        changes: item.changes.map((change) => ({
          path: change.path,
          kind: change.kind === "delete" ? "delete" : change.kind === "add" ? "add" : "modify",
        })),
      },
    },
  ]
}

function mapWebSearch(
  item: Extract<ThreadItem, { type: "web_search" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const ts = Date.now()
  if (phase === "item.started") {
    state.stats.toolCalls = (state.stats.toolCalls ?? 0) + 1
    return [
      {
        type: "tool.started",
        timestamp: ts,
        data: {
          toolId: item.id,
          name: "web_search",
          kind: "builtin",
          input: { query: item.query },
        },
      },
      { type: "stats.updated", timestamp: ts, data: state.stats },
    ]
  }

  if (phase === "item.completed") {
    return [
      {
        type: "tool.completed",
        timestamp: ts,
        data: { toolId: item.id, name: "web_search", success: true, output: item.query },
      },
    ]
  }

  return []
}

function mapTodoList(
  item: Extract<ThreadItem, { type: "todo_list" }>,
  phase: "item.started" | "item.updated" | "item.completed",
  state: RunState,
): AgentEvent[] {
  const summary = item.items
    .map((todo) => `${todo.completed ? "[x]" : "[ ]"} ${todo.text}`)
    .join("\n")
  const ts = Date.now()

  if (phase === "item.started") {
    state.stats.toolCalls = (state.stats.toolCalls ?? 0) + 1
    return [
      {
        type: "tool.started",
        timestamp: ts,
        data: { toolId: item.id, name: "todo_list", kind: "builtin", input: { items: item.items } },
      },
      { type: "stats.updated", timestamp: ts, data: state.stats },
    ]
  }

  if (phase === "item.completed") {
    return [
      {
        type: "tool.completed",
        timestamp: ts,
        data: { toolId: item.id, name: "todo_list", success: true, output: summary },
      },
    ]
  }

  return [
    {
      type: "tool.progress",
      timestamp: ts,
      data: { toolId: item.id, message: summary },
    },
  ]
}

function mapItemEvent(
  itemEvent: Extract<ThreadEvent, { type: "item.started" | "item.updated" | "item.completed" }>,
  state: RunState,
): AgentEvent[] {
  const { item, type } = itemEvent

  switch (item.type) {
    case "agent_message":
      return mapAgentMessage(item, type, state)
    case "reasoning":
      return mapReasoning(item, type, state)
    case "command_execution":
      return mapCommandExecution(item, type, state)
    case "file_change":
      return type === "item.completed" ? mapFileChange(item) : []
    case "mcp_tool_call":
      return mapMcpToolCall(item, type, state)
    case "web_search":
      return mapWebSearch(item, type, state)
    case "todo_list":
      return mapTodoList(item, type, state)
    case "error":
      return [createErrorEvent("PROVIDER_ERROR", item.message, true)]
    default:
      return []
  }
}

function mapCodexEvent(event: ThreadEvent, state: RunState): AgentEvent[] {
  switch (event.type) {
    case "thread.started":
    case "turn.started":
      return []
    case "turn.completed":
      return [mapUsageToStats(event.usage, state)]
    case "turn.failed":
      state.hasError = true
      state.lastErrorMessage = event.error.message
      return [createErrorEvent("PROVIDER_ERROR", event.error.message)]
    case "error":
      state.hasError = true
      state.lastErrorMessage = event.message
      return [createErrorEvent("PROVIDER_ERROR", event.message)]
    case "item.started":
    case "item.updated":
    case "item.completed":
      return mapItemEvent(event, state)
    default:
      return []
  }
}

const formatParseError = (error: Error): AgentEvent =>
  createErrorEvent("PARSE_ERROR", `Failed to parse output: ${error.message}`)

export function createCodexAgent(config: AgentConfig): Agent {
  const providerOptions = (config.providerOptions ?? {}) as Partial<CodexThreadOptions>
  const codexClient = new Codex({
    ...(config.providerOptions as Record<string, unknown>),
    env: config.env ?? (config.providerOptions as { env?: Record<string, string> })?.env,
  })

  function run<T = string>(options: RunOptions<T>): RunHandle<T> {
    const state = createRunState()
    const { promise, resolve, reject } = Promise.withResolvers<T>()
    const source = runThreadEvents(options, state, resolve, reject)

    return runWithEvents(source, promise, reject)
  }

  async function* runThreadEvents<T>(
    options: RunOptions<T>,
    state: RunState,
    resolve: (output: T) => void,
    reject: (error: Error) => void,
  ): AsyncGenerator<AgentEvent, void> {
    const emitRaw = options.emitRawEvents ?? false

    const thread = codexClient.startThread({
      ...providerOptions,
      model: config.model ?? providerOptions.model,
      workingDirectory: config.cwd ?? providerOptions.workingDirectory,
    })

    try {
      const prompt = renderMessages(options.messages)
      const { events } = await thread.runStreamed(prompt, {
        outputSchema: options.outputSchema?.toJSONSchema(),
        signal: options.abortSignal,
      } satisfies CodexTurnOptions)

      for await (const event of events) {
        if (emitRaw) {
          const rawEvent: RawEvent<ThreadEvent> = {
            type: "raw",
            timestamp: Date.now(),
            provider: "codex",
            data: event,
          }
          yield rawEvent
        }

        const mapped = mapCodexEvent(event, state)
        for (const item of mapped) {
          yield item
        }

        if (state.hasError) {
          reject(new Error(state.lastErrorMessage ?? "Codex run failed"))
          return
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
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      const code = err.name === "AbortError" ? ("ABORTED" as const) : ("PROVIDER_ERROR" as const)
      yield createErrorEvent(code, err.message, err.name === "AbortError")
      reject(err)
    }
  }

  async function close(): Promise<void> {
    // Codex SDK does not expose a close method; nothing to clean up.
  }

  return { provider: config.provider, model: config.model, run, close }
}
