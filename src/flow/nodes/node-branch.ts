import type { Message } from "../../types.ts"
import type { FlowContext, FlowNode } from "../types.ts"

type Predicate<T> = (output: T, messages: Message[]) => boolean

/**
 * Multi-way conditional branch. Evaluates predicates in order and runs the
 * first matching node. If no predicate matches, returns `[]`.
 * Use `() => true` as the last predicate for a catch-all.
 *
 * @example
 * branch<{ status: string }>([
 *   [(o) => o.status === "approved", approvedNode],
 *   [(o) => o.status === "rejected", rejectedNode],
 *   [() => true, fallbackNode],
 * ])
 */
export function branch<T>(cases: [Predicate<T>, FlowNode][]): FlowNode {
  return async (messages: Message[], ctx: FlowContext): Promise<Message[]> => {
    const output = messages.at(-1)?.data as T
    for (const [predicate, node] of cases) {
      if (predicate(output, messages)) {
        return node(messages, ctx)
      }
    }
    return []
  }
}
