import type { Agent, AgentConfig, AgentEvent } from "../agents/index.ts"
import type { Message } from "../types.ts"
import type { FlowStats, FlowStatsSnapshot } from "./flow-stats.ts"

// ============================================
// AGENT REFERENCES
// ============================================

export type AgentLike = string | AgentConfig | Agent

// ============================================
// FLOW NODE
// ============================================

export type FlowNode = (messages: Message[], ctx: FlowContext) => Promise<Message[]>

// ============================================
// FLOW CONTEXT (internal, created by flow.run)
// ============================================

export interface FlowContext {
  flowId: string
  input: string
  defaultAgent?: AgentLike
  cwd?: string
  signal?: AbortSignal
  emit: (event: FlowEvent) => void
  stats: FlowStats
}

// ============================================
// FLOW OPTIONS & RESULT
// ============================================

export interface FlowOptions {
  defaultAgent?: AgentLike
  messages?: Message[]
  cwd?: string
  signal?: AbortSignal
  timeout?: number
}

export interface FlowResult<T = unknown> {
  messages: Message[]
  output?: T
  stats: FlowStatsSnapshot
}

// ============================================
// FLOW HANDLE (dual-mode: await + iterate)
// ============================================

export type FlowHandle<T = unknown> = Promise<FlowResult<T>> & {
  [Symbol.asyncIterator](): AsyncGenerator<FlowEvent, void>
  result: Promise<FlowResult<T>>
  abort(): void
}

// ============================================
// FLOW EVENTS
// ============================================

export type FlowEvent =
  | { type: "flow.started"; timestamp: number; data: { flowId: string; input: string } }
  | { type: "flow.completed"; timestamp: number; data: { flowId: string } }
  | { type: "flow.failed"; timestamp: number; data: { flowId: string; error: string } }
  | {
      type: "agent.started"
      timestamp: number
      data: {
        flowId: string
        agentId: string
        role: string
        provider: string
        model: string
      }
    }
  | {
      type: "agent.completed"
      timestamp: number
      data: {
        flowId: string
        agentId: string
        role: string
        provider: string
        model: string
      }
    }
  | {
      type: "agent.failed"
      timestamp: number
      data: {
        flowId: string
        agentId: string
        role: string
        provider: string
        model: string
        error: string
      }
    }
  | {
      type: "agent.event"
      timestamp: number
      data: {
        flowId: string
        agentId: string
        role: string
        provider: string
        model: string
        event: AgentEvent
      }
    }
  | {
      type: "flow.stats.updated"
      timestamp: number
      data: { flowId: string; stats: FlowStatsSnapshot }
    }
