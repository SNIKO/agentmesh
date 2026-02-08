import type { z } from "zod"
import type { AgentStats } from "../../agents/index.ts"
import type { Message } from "../../types.ts"
import { FlowError } from "../errors.ts"

import type { AgentLike, FlowContext, FlowNode } from "../types.ts"
import { getAgentInstance, nextRunId, tryParseData } from "./node-utils.ts"

export interface AgentNodeOptions<T = unknown> {
  outputSchema?: z.ZodSchema<T>
}

export function agent<T = unknown>(
  role: string,
  prompt: string,
  agentLike?: AgentLike,
  options?: AgentNodeOptions<T>,
): FlowNode {
  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    const agentInstance = getAgentInstance(agentLike, ctx)
    const agentId = nextRunId("run")
    const provider = agentInstance.provider
    const model = agentInstance.model

    ctx.emit({
      type: "agent.started",
      timestamp: Date.now(),
      data: { flowId: ctx.flowId, agentId, role, provider, model },
    })

    ctx.stats.recordAgentStarted(agentId, role, provider, model)
    ctx.emit(ctx.stats.makeStatsEvent(ctx.flowId))

    try {
      const runMessages: Message[] = [...messages, { role: "user", content: prompt }]

      const handle = agentInstance.run({
        messages: runMessages,
        outputSchema: options?.outputSchema,
        abortSignal: ctx.signal,
      })

      for await (const event of handle) {
        ctx.emit({
          type: "agent.event",
          timestamp: Date.now(),
          data: { flowId: ctx.flowId, agentId, role, provider, model, event },
        })

        if (event.type === "stats.updated") {
          ctx.stats.updateAgentStats(agentId, (event as { data: AgentStats }).data)
          ctx.emit(ctx.stats.makeStatsEvent(ctx.flowId))
        }
      }

      const rawOutput = await handle.output

      const content = typeof rawOutput === "string" ? rawOutput : JSON.stringify(rawOutput)
      const data = tryParseData(content, options?.outputSchema as z.ZodSchema<T> | undefined)

      ctx.emit({
        type: "agent.completed",
        timestamp: Date.now(),
        data: { flowId: ctx.flowId, agentId, role, provider, model },
      })

      ctx.stats.recordAgentCompleted(agentId)
      ctx.emit(ctx.stats.makeStatsEvent(ctx.flowId))

      return [{ role, content, data }]
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))

      ctx.emit({
        type: "agent.failed",
        timestamp: Date.now(),
        data: {
          flowId: ctx.flowId,
          agentId,
          role,
          provider,
          model,
          error: error.message,
        },
      })

      ctx.stats.recordAgentFailed(agentId)
      ctx.emit(ctx.stats.makeStatsEvent(ctx.flowId))

      throw new FlowError(`Agent "${role}" failed: ${error.message}`, role, agentId, error)
    } finally {
      try {
        await agentInstance.close()
      } catch {
        // Swallow close errors so the original failure propagates
      }
    }
  }
}
