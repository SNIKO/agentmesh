import type { z } from "zod"
import type { Message } from "../types.ts"

// ============================================
// PROVIDER & CONFIG
// ============================================

export type Provider = "copilot" | "codex" | "opencode" | "claude"

export type McpServerConfig =
  | {
      type?: "stdio"
      command: string
      tools: string[]
      args?: string[]
      env?: Record<string, string>
    }
  | { type: "http" | "sse"; url: string; tools: string[]; headers?: Record<string, string> }

export interface AgentConfig {
  provider: Provider
  model: string
  cwd?: string
  env?: Record<string, string>
  mcpServers?: Record<string, McpServerConfig>
  providerOptions?: Record<string, unknown>
}

// ============================================
// RUN OPTIONS & HANDLE
// ============================================

export interface RunOptions<T = string> {
  messages: Message[]
  streaming?: boolean
  abortSignal?: AbortSignal
  outputSchema?: z.ZodSchema<T>
  emitRawEvents?: boolean
}

/**
 * Handle returned by `agent.run()`. Can be used in three ways:
 *
 * 1. **Await directly** for just the output:
 *    ```ts
 *    const output = await agent.run({ messages })
 *    ```
 *
 * 2. **Iterate** to receive events, then await for output:
 *    ```ts
 *    const handle = agent.run({ messages })
 *    for await (const event of handle) { handleEvent(event) }
 *    const output = await handle
 *    ```
 *
 * 3. **Access output promise** explicitly:
 *    ```ts
 *    const output = await agent.run({ messages }).output
 *    ```
 */
export type RunHandle<T = string> = Promise<T> & {
  [Symbol.asyncIterator](): AsyncGenerator<AgentEvent, void>
  output: Promise<T>
}

// ============================================
// AGENT
// ============================================

export interface Agent {
  readonly provider: string
  readonly model: string
  run<T = string>(options: RunOptions<T>): RunHandle<T>
  close(): Promise<void>
}

// ============================================
// STATS
// ============================================

export interface AgentStats {
  tokens: {
    input?: number
    output?: number
    total?: number
  }
  context?: {
    contextSize?: number
    usedTokens?: number
  }
  toolCalls?: number
  costUsd?: number
  durationMs?: number
}

// ============================================
// EVENTS
// ============================================

export interface EventBase {
  type: string
  timestamp: number
}

export interface RawEvent<T = unknown> extends EventBase {
  type: "raw"
  provider: Provider
  data: T
}

// Messages
export interface MessageDeltaEvent extends EventBase {
  type: "message.delta"
  data: {
    messageId: string
    delta: string
  }
}

export interface MessageCompletedEvent extends EventBase {
  type: "message.completed"
  data: {
    messageId: string
    content: string
  }
}

// Reasoning
export interface ReasoningDeltaEvent extends EventBase {
  type: "reasoning.delta"
  data: {
    reasoningId: string
    delta: string
  }
}

export interface ReasoningCompletedEvent extends EventBase {
  type: "reasoning.completed"
  data: {
    reasoningId: string
    content: string
  }
}

// Tools
export type ToolKind = "builtin" | "mcp"

export interface ToolStartedEvent extends EventBase {
  type: "tool.started"
  data: {
    toolId: string
    name: string
    kind: ToolKind
    input?: Record<string, unknown>
    mcp?: { server: string; tool: string }
  }
}

export interface ToolProgressEvent extends EventBase {
  type: "tool.progress"
  data: {
    toolId: string
    message: string
  }
}

export interface ToolCompletedEvent extends EventBase {
  type: "tool.completed"
  data: {
    toolId: string
    name: string
    success: boolean
    output?: string
    error?: string
  }
}

// Files
export type FileChangeKind = "add" | "modify" | "delete"

export interface FileChangedEvent extends EventBase {
  type: "file.changed"
  data: {
    changes: Array<{ path: string; kind: FileChangeKind }>
  }
}

// Stats
export interface StatsUpdatedEvent extends EventBase {
  type: "stats.updated"
  data: AgentStats
}

// Errors
export type ErrorCode = "ABORTED" | "PARSE_ERROR" | "PROVIDER_ERROR" | "CONFIG_ERROR" | "UNKNOWN"

export interface AgentErrorEvent extends EventBase {
  type: "error"
  data: {
    code: ErrorCode
    message: string
    recoverable: boolean
  }
}

// Union
export type AgentEvent =
  | RawEvent
  | MessageDeltaEvent
  | MessageCompletedEvent
  | ReasoningDeltaEvent
  | ReasoningCompletedEvent
  | ToolStartedEvent
  | ToolProgressEvent
  | ToolCompletedEvent
  | FileChangedEvent
  | StatsUpdatedEvent
  | AgentErrorEvent
