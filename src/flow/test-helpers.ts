/**
 * Test helpers for flow tests.
 * Provides mock agents and context factories.
 */
import { mock } from "bun:test"
import type { AgentEvent, AgentStats, RunHandle } from "../agents/index.ts"
import { createAsyncQueue } from "../utils/asyncQueue.ts"
import { FlowStats } from "./flow-stats.ts"
import type { FlowContext, FlowEvent, FlowNode } from "./types.ts"

// ============================================
// MOCK AGENT FACTORY
// ============================================

export interface MockAgentBehavior {
  /** The raw output the agent will return */
  output: string
  /** Events the agent will emit before completing */
  events?: AgentEvent[]
  /** If set, the agent will throw this error */
  error?: Error
  /** Delay in ms before resolving */
  delay?: number
  /** Capture the messages passed to run() */
  captureMessages?: (messages: Array<{ role: string; content: string; data?: unknown }>) => void
}

/**
 * Creates a mock RunHandle that behaves like a real agent run.
 */
function createMockRunHandle<T = string>(behavior: MockAgentBehavior): RunHandle<T> {
  const eventQueue = createAsyncQueue<AgentEvent>()

  const outputPromise = (async () => {
    // Emit events
    for (const event of behavior.events ?? []) {
      eventQueue.push(event)
    }

    if (behavior.delay) {
      await new Promise((resolve) => setTimeout(resolve, behavior.delay))
    }

    // Emit a default stats.updated event only if none was provided
    const hasStats = behavior.events?.some((e) => e.type === "stats.updated")
    if (!hasStats) {
      const statsEvent: AgentEvent = {
        type: "stats.updated",
        timestamp: Date.now(),
        data: {
          tokens: { input: 10, output: 20, total: 30 },
          costUsd: 0.001,
          durationMs: 100,
        } satisfies AgentStats,
      }
      eventQueue.push(statsEvent)
    }
    eventQueue.close()

    if (behavior.error) throw behavior.error
    return behavior.output as T
  })()

  const handle = outputPromise as RunHandle<T>
  handle[Symbol.asyncIterator] = () => eventQueue[Symbol.asyncIterator]()
  handle.output = outputPromise
  return handle
}

/**
 * Creates a mock createAgent function. Pass a map of agent responses keyed by
 * provider (or "provider:model") to control what each agent returns.
 *
 * If a string is passed, the agent returns that string as output.
 * If MockAgentBehavior is passed, full control is available.
 */
export function mockCreateAgent(responses: Record<string, string | MockAgentBehavior>) {
  return mock((config: { provider: string; model: string; cwd?: string }) => {
    if (!config.model)
      throw new Error(`Mock agent for provider "${config.provider}" requires a model`)
    const key = `${config.provider}:${config.model}`
    const behavior = responses[key]
    if (!behavior) {
      throw new Error(`No mock response configured for agent "${key}"`)
    }

    const resolved: MockAgentBehavior =
      typeof behavior === "string" ? { output: behavior } : behavior

    return {
      provider: config.provider,
      model: config.model,
      run: mock(
        (options: { messages: Array<{ role: string; content: string; data?: unknown }> }) => {
          resolved.captureMessages?.(options.messages)
          return createMockRunHandle(resolved)
        },
      ),
      close: mock(async () => {}),
    }
  })
}

// ============================================
// MOCK FLOW CONTEXT
// ============================================

export function createMockContext(
  overrides?: Partial<FlowContext>,
): FlowContext & { events: FlowEvent[] } {
  const events: FlowEvent[] = []

  return {
    flowId: "test-flow",
    input: "test input",
    emit: (event: FlowEvent) => events.push(event),
    stats: new FlowStats(),
    events,
    ...overrides,
  }
}

// ============================================
// FAKE FLOW NODES (for testing composition without mocking agents)
// ============================================

/**
 * Creates a FlowNode that returns a single message with the given content.
 * Optionally attaches structured data.
 */
export function fakeNode(role: string, content: string, data?: unknown): FlowNode {
  return async () => [{ role, content, data }]
}

/**
 * Creates a FlowNode that echoes back a summary of messages it received.
 * Useful for verifying chain/fork pass the right messages.
 */
export function echoNode(role: string): FlowNode {
  return async (messages) => [
    {
      role,
      content: [
        `Input Messages (${messages.length}):`,
        ...messages.map((m) => `  ${m.role}: ${m.content}`),
      ].join("\n"),
    },
  ]
}

/**
 * Creates a FlowNode that tracks how many times it was called and returns
 * different data each time. Useful for loop tests.
 */
export function counterNode(
  role: string,
  responses: Array<{ content: string; data?: unknown }>,
): FlowNode {
  let callCount = 0
  return async () => {
    const idx = Math.min(callCount++, responses.length - 1)
    return [{ role, content: responses[idx].content, data: responses[idx].data }]
  }
}

/**
 * Creates a FlowNode that fails with the given error.
 */
export function failingNode(error: Error): FlowNode {
  return async () => {
    throw error
  }
}

/**
 * Creates a FlowNode that delays before returning.
 */
export function delayNode(role: string, content: string, delayMs: number): FlowNode {
  return async () => {
    await new Promise((resolve) => setTimeout(resolve, delayMs))
    return [{ role, content }]
  }
}
