import type { Message } from "../../types.ts"
import type { FlowContext, FlowNode } from "../types.ts"

export function fork(nodes: FlowNode[]): FlowNode {
  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    // Create a child abort controller for fail-fast behavior
    const controller = new AbortController()
    if (ctx.signal) {
      const parentSignal = ctx.signal
      if (parentSignal.aborted) {
        controller.abort(parentSignal.reason)
      } else {
        parentSignal.addEventListener("abort", () => controller.abort(parentSignal.reason), {
          once: true,
        })
      }
    }

    const childCtx: FlowContext = { ...ctx, signal: controller.signal }

    try {
      const results = await Promise.all(
        nodes.map(async (node) => {
          try {
            return await node(messages, childCtx)
          } catch (e) {
            controller.abort()
            throw e
          }
        }),
      )
      return results.flat()
    } catch (e) {
      controller.abort()
      throw e
    }
  }
}
