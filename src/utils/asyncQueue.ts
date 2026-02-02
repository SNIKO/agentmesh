export interface AsyncQueue<T> {
  push(value: T): void
  close(): void
  fail(error: unknown): void
  [Symbol.asyncIterator](): AsyncGenerator<T, void, void>
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const queue: T[] = []
  let done = false
  let error: unknown

  let resolveWait: (() => void) | null = null

  function wake() {
    resolveWait?.()
    resolveWait = null
  }

  return {
    push(value) {
      if (done) return
      queue.push(value)
      wake()
    },

    close() {
      if (done) return
      done = true
      wake()
    },

    fail(err) {
      if (done) return
      error = err
      done = true
      wake()
    },

    async *[Symbol.asyncIterator](): AsyncGenerator<T, void, void> {
      while (!done || queue.length > 0) {
        if (queue.length === 0) {
          if (done) break
          await new Promise<void>((resolve) => {
            resolveWait = resolve
          })
          continue
        }

        const item = queue.shift()
        if (item !== undefined) {
          yield item
        }
      }

      if (error) {
        throw error
      }
    },
  }
}
