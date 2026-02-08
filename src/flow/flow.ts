import type { Message } from "../types.ts"
import { createAsyncQueue } from "../utils/asyncQueue.ts"
import { FlowError } from "./errors.ts"
import { FlowStats } from "./flow-stats.ts"
import { agent, branch, chain, consensus, fork, loop } from "./nodes/index.ts"
import type {
  FlowContext,
  FlowEvent,
  FlowHandle,
  FlowNode,
  FlowOptions,
  FlowResult,
} from "./types.ts"

// ============================================
// flow.run()
// ============================================

let flowCounter = 0

function run<T = unknown>(node: FlowNode, input: string, options?: FlowOptions): FlowHandle<T> {
  const flowId = `flow_${++flowCounter}_${Date.now().toString(36)}`
  const eventQueue = createAsyncQueue<FlowEvent>()
  let settled = false
  const controller = new AbortController()
  const externalSignal = options?.signal
  let cleanupAbortListener: (() => void) | undefined
  let cleanupExternalAbort: (() => void) | undefined

  if (externalSignal) {
    const onExternalAbort = () => controller.abort(externalSignal.reason)
    if (externalSignal.aborted) {
      onExternalAbort()
    } else {
      externalSignal.addEventListener("abort", onExternalAbort, { once: true })
      cleanupExternalAbort = () => externalSignal.removeEventListener("abort", onExternalAbort)
    }
  }

  const emit = (event: FlowEvent) => eventQueue.push(event)

  const cleanupAbortListeners = () => {
    cleanupAbortListener?.()
    cleanupAbortListener = undefined
    cleanupExternalAbort?.()
    cleanupExternalAbort = undefined
  }

  const markFailed = (error: Error) => {
    if (settled) return
    settled = true
    if (!controller.signal.aborted) {
      controller.abort(error)
    }
    emit({ type: "flow.failed", timestamp: Date.now(), data: { flowId, error: error.message } })
    eventQueue.close()
    cleanupAbortListeners()
  }

  const ctx: FlowContext = {
    flowId,
    input,
    defaultAgent: options?.defaultAgent,
    cwd: options?.cwd,
    signal: controller.signal,
    stats: new FlowStats(),
    emit,
  }

  // Build initial messages
  const seedMessages: Message[] = [...(options?.messages ?? []), { role: "user", content: input }]

  // Start the pipeline
  const resultPromise = (async (): Promise<FlowResult<T>> => {
    emit({ type: "flow.started", timestamp: Date.now(), data: { flowId, input } })

    try {
      const newMessages = await node(seedMessages, ctx)
      const allMessages = [...seedMessages, ...newMessages]

      // Extract output from last message with data
      let output: T | undefined
      for (let i = allMessages.length - 1; i >= 0; i--) {
        if (allMessages[i].data !== undefined) {
          output = allMessages[i].data as T
          break
        }
      }

      // Build final stats snapshot from tracker (includes per-agent detail + totals)
      const stats = ctx.stats.snapshot()

      if (!settled) {
        settled = true
        emit({ type: "flow.completed", timestamp: Date.now(), data: { flowId } })
        eventQueue.close()
        cleanupAbortListeners()
      }

      return { messages: allMessages, output, stats }
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      markFailed(error)
      throw e
    }
  })()

  // Apply timeout if configured
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = options?.timeout
    ? new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (settled) return
          const error = new FlowError("Flow timed out", "flow", "", undefined)
          markFailed(error)
          reject(error)
        }, options.timeout)
      })
    : null

  const abortPromise = new Promise<never>((_, reject) => {
    const onAbort = () => {
      if (settled) return
      const reason = controller.signal.reason
      const error =
        reason instanceof Error ? reason : new FlowError("Flow aborted", "flow", "", undefined)
      markFailed(error)
      reject(error)
    }

    if (controller.signal.aborted) {
      onAbort()
      return
    }

    controller.signal.addEventListener("abort", onAbort, { once: true })
    cleanupAbortListener = () => controller.signal.removeEventListener("abort", onAbort)
  })

  const races: Array<Promise<FlowResult<T> | never>> = [resultPromise, abortPromise]
  if (timeoutPromise) races.push(timeoutPromise)

  const timedPromise = Promise.race(races).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    cleanupAbortListeners()
  })

  // Build the dual-mode handle
  const handle = timedPromise as FlowHandle<T>
  handle[Symbol.asyncIterator] = () => eventQueue[Symbol.asyncIterator]()
  handle.result = timedPromise
  handle.abort = () => {
    controller.abort()
  }

  return handle
}

// ============================================
// flow namespace
// ============================================

export const flow = { agent, branch, chain, fork, loop, consensus, run }

export { FlowError } from "./errors.ts"
