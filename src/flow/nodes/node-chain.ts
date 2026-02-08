import type { Message } from "../../types.ts"
import type { FlowContext, FlowNode } from "../types.ts"

export function chain(nodes: FlowNode[]): FlowNode {
  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    const accumulated: Message[] = []
    for (const node of nodes) {
      const newMsgs = await node([...messages, ...accumulated], ctx)
      accumulated.push(...newMsgs)
    }
    return accumulated
  }
}
