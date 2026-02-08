import { describe, expect, test } from "bun:test"
import { createMockContext, delayNode, echoNode, failingNode, fakeNode } from "../test-helpers.ts"
import { fork } from "./node-fork.ts"

describe("fork", () => {
  test("runs nodes concurrently and merges messages", async () => {
    const ctx = createMockContext()
    const node = fork([
      fakeNode("branch1", "Result 1"),
      fakeNode("branch2", "Result 2"),
      fakeNode("branch3", "Result 3"),
    ])

    const result = await node([{ role: "user", content: "Go" }], ctx)

    expect(result).toEqual([
      { role: "branch1", content: "Result 1", data: undefined },
      { role: "branch2", content: "Result 2", data: undefined },
      { role: "branch3", content: "Result 3", data: undefined },
    ])
  })

  test("all branches see the same input snapshot", async () => {
    const ctx = createMockContext()
    const node = fork([echoNode("A"), echoNode("B"), echoNode("C")])

    const input = [{ role: "user", content: "Go" }]
    const result = await node(input, ctx)

    const expected = "Input Messages (1):\n  user: Go"
    expect(result).toEqual([
      { role: "A", content: expected },
      { role: "B", content: expected },
      { role: "C", content: expected },
    ])
  })

  test("fail-fast: one failure aborts others", async () => {
    const ctx = createMockContext()
    const node = fork([delayNode("slow", "I'm slow", 1000), failingNode(new Error("fast failure"))])

    expect(node([{ role: "user", content: "Go" }], ctx)).rejects.toThrow("fast failure")
  })

  test("runs branches truly concurrently (faster than sequential)", async () => {
    const ctx = createMockContext()
    const node = fork([delayNode("A", "A", 50), delayNode("B", "B", 50), delayNode("C", "C", 50)])

    const start = Date.now()
    await node([{ role: "user", content: "Go" }], ctx)
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(120)
  })
})
