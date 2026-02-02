import type { AgentEvent, Message, RunHandle, RunOptions } from "../types"
import { createAsyncQueue } from "../utils/asyncQueue"

export interface Agent {
  run<T = string>(options: RunOptions<T>): RunHandle<T>
  close(): Promise<void>
}

export function renderMessages(messages: Message[]): string {
  return messages
    .map((msg) => `<message role="${msg.role}">\n${msg.content}\n</message>`)
    .join("\n\n")
}

export function runWithEvents<T>(
  source: AsyncGenerator<AgentEvent, void>,
  promise: Promise<T>,
  reject: (error: Error) => void,
): RunHandle<T> {
  const eventQueue = createAsyncQueue<AgentEvent>()

  void (async () => {
    try {
      for await (const event of source) {
        eventQueue.push(event)
      }
      eventQueue.close()
    } catch (e) {
      const error = e instanceof Error ? e : new Error(String(e))
      reject(error)
      eventQueue.fail(error)
    }
  })()

  const handle = promise as RunHandle<T>
  handle[Symbol.asyncIterator] = () => eventQueue[Symbol.asyncIterator]()
  handle.output = promise
  return handle
}

export type ParseResult<T> =
  | { ok: true; output: T }
  | { ok: false; error: Error; event: AgentEvent }

export function stripCodeBlock(content: string): string {
  const trimmed = content.trim()
  const fence = /^```[\w-]*\s*\n?([\s\S]*?)\n?```$/m
  const match = trimmed.match(fence)
  return match ? match[1].trim() : trimmed
}

export function tryParseOutput<T>(
  rawOutput: string,
  schema: RunOptions<T>["outputSchema"] | undefined,
  onError: (error: Error) => AgentEvent,
): ParseResult<T> {
  const cleaned = stripCodeBlock(rawOutput)

  if (!schema) {
    return { ok: true, output: cleaned as T }
  }

  try {
    return { ok: true, output: schema.parse(JSON.parse(cleaned)) as T }
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e))
    return {
      ok: false,
      error,
      event: onError(error),
    }
  }
}
