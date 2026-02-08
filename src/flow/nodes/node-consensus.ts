import type { Message } from "../../types.ts"
import type { AgentLike, FlowContext, FlowNode } from "../types.ts"
import { agent } from "./node-agent.ts"
import { fork } from "./node-fork.ts"

export function consensus(config: {
  role: string
  prompt: string
  agents: AgentLike[]
  jury: AgentLike
  juryPrompt?: string
}): FlowNode {
  // Single agent — no point in a jury, just run it directly
  if (config.agents.length === 1) {
    return agent(config.role, config.prompt, config.agents[0])
  }

  // Fork agents concurrently, then feed all outputs to the jury
  const agentNodes = config.agents.map((agentLike, i) =>
    agent(`${config.role}_${i + 1}`, config.prompt, agentLike),
  )

  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    // Run all agents concurrently
    const agentMessages = await fork(agentNodes)(messages, ctx)

    const agentCount = config.agents.length
    const juryInstruction =
      config.juryPrompt ??
      `You are the master ${config.role}. Synthesize responses from ${agentCount} ${config.role}s into a single answer for the user.
Prioritize facts where multiple ${config.role}s agree and present them confidently.
Call out points without agreement or unclear evidence as "not sure".
Reflect confidence based on how many ${config.role}s align.`

    const juryNode = agent(config.role, juryInstruction, config.jury)

    // Jury sees original messages + agent outputs
    return juryNode(
      [...messages, { role: "user", content: config.prompt, data: undefined }, ...agentMessages],
      ctx,
    )
  }
}
