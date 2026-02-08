import { describe, expect, test } from "bun:test"
import { counterNode, createMockContext, fakeNode } from "../test-helpers.ts"
import { loop } from "./node-loop.ts"

describe("loop", () => {
  test("iterates until condition is met", async () => {
    const ctx = createMockContext()

    const node = loop<{ done: boolean }>({
      work: counterNode("loop-worker", [
        { content: "iteration 1 result", data: { done: false } },
        { content: "iteration 2 result", data: { done: false } },
        { content: "iteration 3 result", data: { done: true } },
      ]),
      until: (output) => output.done,
      maxIterations: 10,
    })

    const result = await node([{ role: "requester", content: "start loop" }], ctx)

    expect(result).toEqual([
      { role: "loop-worker", content: "iteration 1 result", data: { done: false } },
      { role: "loop-worker", content: "iteration 2 result", data: { done: false } },
      { role: "loop-worker", content: "iteration 3 result", data: { done: true } },
    ])
  })

  test("respects maxIterations limit", async () => {
    const ctx = createMockContext()

    const node = loop<{ done: boolean }>({
      work: fakeNode("loop-worker", "still running", { done: false }),
      until: (output) => output.done,
      maxIterations: 3,
    })

    const result = await node([{ role: "requester", content: "start loop" }], ctx)

    expect(result).toEqual([
      { role: "loop-worker", content: "still running", data: { done: false } },
      { role: "loop-worker", content: "still running", data: { done: false } },
      { role: "loop-worker", content: "still running", data: { done: false } },
    ])
  })

  test("defaults to maxIterations=10", async () => {
    const ctx = createMockContext()

    const node = loop<{ done: boolean }>({
      work: fakeNode("loop-worker", "still running", { done: false }),
      until: (output) => output.done,
    })

    const result = await node([{ role: "requester", content: "start loop" }], ctx)

    expect(result).toHaveLength(10)
    for (const msg of result) {
      expect(msg).toEqual({ role: "loop-worker", content: "still running", data: { done: false } })
    }
  })

  test("stops on first iteration if condition is immediately true", async () => {
    const ctx = createMockContext()

    const node = loop<{ done: boolean }>({
      work: fakeNode("loop-worker", "done immediately", { done: true }),
      until: (output) => output.done,
    })

    const result = await node([{ role: "requester", content: "start loop" }], ctx)

    expect(result).toEqual([
      { role: "loop-worker", content: "done immediately", data: { done: true } },
    ])
  })

  test("work node sees accumulated messages from prior iterations", async () => {
    const ctx = createMockContext()

    const initialMessages = [{ role: "requester", content: "start loop" }]
    const workInputs: Array<Array<{ role: string; content: string; data?: unknown }>> = []

    const work = async (messages: Array<{ role: string; content: string; data?: unknown }>) => {
      workInputs.push(messages)
      const iteration = workInputs.length

      return [
        {
          role: "loop-worker",
          content: `iteration ${iteration} output`,
          data: { done: iteration === 2 },
        },
      ]
    }

    const node = loop<{ done: boolean }>({
      work,
      until: (output) => output.done,
    })

    const result = await node(initialMessages, ctx)

    expect(result).toEqual([
      { role: "loop-worker", content: "iteration 1 output", data: { done: false } },
      { role: "loop-worker", content: "iteration 2 output", data: { done: true } },
    ])

    expect(workInputs).toEqual([
      initialMessages,
      [
        ...initialMessages,
        { role: "loop-worker", content: "iteration 1 output", data: { done: false } },
      ],
    ])
  })
})
