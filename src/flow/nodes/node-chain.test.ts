import { describe, expect, test } from "bun:test"
import { createMockContext, echoNode, failingNode, fakeNode } from "../test-helpers.ts"
import { chain } from "./node-chain.ts"

describe("chain", () => {
  test("runs nodes sequentially and accumulates messages", async () => {
    const ctx = createMockContext()
    const node = chain([
      fakeNode("coder", "Hello from step 1"),
      fakeNode("reviewer", "", { success: false }),
      fakeNode("coder", "Hello from step 3"),
    ])

    const result = await node([{ role: "user", content: "Go" }], ctx)

    expect(result).toHaveLength(3)
    expect(result[0]).toEqual({ role: "coder", content: "Hello from step 1", data: undefined })
    expect(result[1]).toEqual({ role: "reviewer", content: "", data: { success: false } })
    expect(result[2]).toEqual({ role: "coder", content: "Hello from step 3", data: undefined })
  })

  test("each node sees prior outputs", async () => {
    const ctx = createMockContext()
    const node = chain([fakeNode("coder1", "msg-A"), echoNode("coder2"), echoNode("coder3")])

    const result = await node([{ role: "user", content: "Prev flow messages" }], ctx)

    const echo2 = ["Input Messages (2):", "  user: Prev flow messages", "  coder1: msg-A"].join(
      "\n",
    )

    const echo3 = [
      "Input Messages (3):",
      "  user: Prev flow messages",
      "  coder1: msg-A",
      `  coder2: ${echo2}`,
    ].join("\n")

    expect(result).toEqual([
      { role: "coder1", content: "msg-A", data: undefined },
      { role: "coder2", content: echo2 },
      { role: "coder3", content: echo3 },
    ])
  })

  test("empty chain returns no messages", async () => {
    const ctx = createMockContext()
    const result = await chain([])([{ role: "user", content: "Go" }], ctx)
    expect(result).toEqual([])
  })

  test("propagates errors from a failing node", async () => {
    const ctx = createMockContext()
    const node = chain([
      fakeNode("A", "ok"),
      failingNode(new Error("boom")),
      fakeNode("C", "never reached"),
    ])

    expect(node([{ role: "user", content: "Go" }], ctx)).rejects.toThrow("boom")
  })
})
