import type { z } from "zod"
import type { AgentEvent } from "./events"

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
  model?: string
  cwd?: string
  env?: Record<string, string>
  mcpServers?: Record<string, McpServerConfig>
  providerOptions?: Record<string, unknown>
}

// ============================================
// RUN OPTIONS & HANDLE
// ============================================

export interface Message {
  role: string
  content: string
}

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
  costUsd?: number
  durationMs?: number
}

export * from "./events"
