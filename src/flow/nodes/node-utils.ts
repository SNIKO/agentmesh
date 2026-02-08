import type { z } from "zod"
import { stripCodeBlock } from "../../agents/agent-utils.ts"
import { type Agent, type AgentConfig, createAgent, type Provider } from "../../agents/index.ts"
import type { AgentLike, FlowContext } from "../types.ts"

// ============================================
// Node utilities
// ============================================

let runCounter = 0

export function getAgentInstance(agentLike: AgentLike | undefined, ctx: FlowContext): Agent {
  const value = agentLike ?? ctx.defaultAgent
  if (!value) throw new Error("No agent provided and no defaultAgent configured")

  // Pre-constructed agent instance
  if (typeof value === "object" && "run" in value && typeof value.run === "function") {
    return value as Agent
  }

  // Agent config
  if (typeof value === "object") {
    const config: AgentConfig = {
      cwd: ctx.cwd,
      ...(value as AgentConfig),
    }
    return createAgent(config)
  }

  // Agent id string
  const id = value as string
  const [provider, ...rest] = id.split(":")
  const model = rest.join(":")
  const config: AgentConfig = {
    provider: provider as Provider,
    model,
    cwd: ctx.cwd,
  }
  return createAgent(config)
}

export function nextRunId(prefix = "run"): string {
  return `${prefix}_${++runCounter}_${Date.now().toString(36)}`
}

export function tryParseData<T>(content: string, schema?: z.ZodSchema<T>): T | undefined {
  if (!schema) return undefined
  const cleaned = stripCodeBlock(content)
  return schema.parse(JSON.parse(cleaned))
}
