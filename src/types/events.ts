import type { AgentStats, Provider } from "./index"

// ============================================
// EVENT SYSTEM
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

export interface ErrorEvent extends EventBase {
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
  | ErrorEvent
