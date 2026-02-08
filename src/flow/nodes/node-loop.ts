import type { Message } from "../../types.ts"
import type { FlowContext, FlowNode } from "../types.ts"

export function loop<T>(config: {
  work: FlowNode
  until: (output: T, messages: Message[]) => boolean
  maxIterations?: number
}): FlowNode {
  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    const max = config.maxIterations ?? 10
    const accumulated: Message[] = []

    for (let i = 0; i < max; i++) {
      const newMsgs = await config.work([...messages, ...accumulated], ctx)
      accumulated.push(...newMsgs)

      const allMessages = [...messages, ...accumulated]
      const output = allMessages.at(-1)?.data as T
      if (config.until(output, allMessages)) break
    }

    return accumulated
  }
}
