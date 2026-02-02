export type SubscriptionHandler<T> = (event: T) => void
export type Subscribe<T> = (listener: SubscriptionHandler<T>) => () => void

export interface SubscriptionToAsyncGeneratorOptions<T> {
  subscribe: Subscribe<T>
  stopWhen?: (event: T) => boolean
  abortSignal?: AbortSignal
  onAbort?: () => void
}

export async function* subscriptionToAsyncGenerator<T>({
  subscribe,
  stopWhen,
  abortSignal,
  onAbort,
}: SubscriptionToAsyncGeneratorOptions<T>): AsyncGenerator<T, void, void> {
  const queue: T[] = []
  let done = false
  let resolveWait: (() => void) | null = null

  const unsubscribe = subscribe((event) => {
    queue.push(event)
    resolveWait?.()
    resolveWait = null

    if (stopWhen?.(event)) {
      done = true
    }
  })

  const abortHandler = () => {
    onAbort?.()
    done = true
    resolveWait?.()
  }

  if (abortSignal) {
    abortSignal.addEventListener("abort", abortHandler)
  }

  try {
    while (!done || queue.length > 0) {
      if (queue.length === 0 && !done) {
        await new Promise<void>((resolve) => {
          resolveWait = resolve
        })
      }

      while (queue.length > 0) {
        const event = queue.shift()
        if (!event) continue

        yield event

        if (stopWhen?.(event)) {
          done = true
        }
      }
    }
  } finally {
    if (abortSignal) {
      abortSignal.removeEventListener("abort", abortHandler)
    }
    unsubscribe()
  }
}
