import type { AgentStats } from "../agents/index.ts"
import type { FlowEvent } from "./types.ts"

export interface AgentRun {
  agentId: string
  role: string
  provider: string
  model: string
  status: "running" | "completed" | "failed"
  stats?: AgentStats
}

export interface FlowTotals {
  toolsUsed: number
  tokensUsed: number
  costUsd: number
  durationMs: number
}

export interface FlowStatsSnapshot {
  runningAgents: number
  agents: AgentRun[]
  totals: FlowTotals
}

export class FlowStats {
  private agents = new Map<string, AgentRun>()
  private totals: FlowTotals = { toolsUsed: 0, tokensUsed: 0, costUsd: 0, durationMs: 0 }

  recordAgentStarted(agentId: string, role: string, provider: string, model: string): void {
    this.agents.set(agentId, { agentId, role, provider, model, status: "running" })
  }

  recordAgentCompleted(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) agent.status = "completed"
  }

  recordAgentFailed(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) agent.status = "failed"
  }

  updateAgentStats(agentId: string, stats: AgentStats): void {
    const agent = this.agents.get(agentId)
    if (agent) agent.stats = stats
    this.recomputeTotals()
  }

  snapshot(): FlowStatsSnapshot {
    let running = 0
    for (const agent of this.agents.values()) {
      if (agent.status === "running") running++
    }

    return {
      runningAgents: running,
      agents: Array.from(this.agents.values()).map((agent) => ({ ...agent })),
      totals: { ...this.totals },
    }
  }

  makeStatsEvent(flowId: string): FlowEvent {
    return {
      type: "flow.stats.updated",
      timestamp: Date.now(),
      data: { flowId, stats: this.snapshot() },
    }
  }

  /** Recompute totals by summing latest snapshot from every agent run. */
  private recomputeTotals(): void {
    let toolsUsed = 0
    let tokensUsed = 0
    let costUsd = 0
    let durationMs = 0

    for (const agent of this.agents.values()) {
      if (!agent.stats) continue
      toolsUsed += agent.stats.toolCalls ?? 0
      const t = agent.stats.tokens
      tokensUsed += t.total ?? (t.input ?? 0) + (t.output ?? 0)
      costUsd += agent.stats.costUsd ?? 0
      durationMs += agent.stats.durationMs ?? 0
    }

    this.totals = { toolsUsed, tokensUsed, costUsd, durationMs }
  }
}
