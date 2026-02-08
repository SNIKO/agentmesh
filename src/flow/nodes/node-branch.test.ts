import { describe, expect, test } from "bun:test"
import { createMockContext, fakeNode } from "../test-helpers.ts"
import { branch } from "./node-branch.ts"

describe("branch", () => {
  test("runs the first matching case", async () => {
    const ctx = createMockContext()
    const node = branch<{ status: string }>([
      [(o) => o.status === "approved", fakeNode("approved", "Looks good!")],
      [(o) => o.status === "rejected", fakeNode("rejected", "Needs work")],
    ])

    const messages = [{ role: "reviewer", content: "approved", data: { status: "approved" } }]
    const result = await node(messages, ctx)

    expect(result).toEqual([{ role: "approved", content: "Looks good!", data: undefined }])
  })

  test("evaluates cases in order and picks the first match", async () => {
    const ctx = createMockContext()
    const node = branch<{ score: number }>([
      [(o) => o.score >= 90, fakeNode("grade", "A")],
      [(o) => o.score >= 80, fakeNode("grade", "B")],
      [(o) => o.score >= 70, fakeNode("grade", "C")],
    ])

    const messages = [{ role: "scorer", content: "85", data: { score: 85 } }]
    const result = await node(messages, ctx)

    expect(result).toEqual([{ role: "grade", content: "B", data: undefined }])
  })

  test("catch-all with () => true as last predicate", async () => {
    const ctx = createMockContext()
    const node = branch<{ status: string }>([
      [(o) => o.status === "approved", fakeNode("approved", "Looks good!")],
      [(o) => o.status === "rejected", fakeNode("rejected", "Needs work")],
      [() => true, fakeNode("fallback", "Unknown status")],
    ])

    const messages = [{ role: "reviewer", content: "pending", data: { status: "pending" } }]
    const result = await node(messages, ctx)

    expect(result).toEqual([{ role: "fallback", content: "Unknown status", data: undefined }])
  })

  test("returns empty when no predicate matches", async () => {
    const ctx = createMockContext()
    const node = branch<{ status: string }>([
      [(o) => o.status === "approved", fakeNode("approved", "Looks good!")],
    ])

    const messages = [{ role: "reviewer", content: "rejected", data: { status: "rejected" } }]
    const result = await node(messages, ctx)

    expect(result).toEqual([])
  })

  test("predicate receives full messages array", async () => {
    const ctx = createMockContext()
    let receivedMessages: unknown[] = []

    const node = branch<unknown>([
      [
        (_output, msgs) => {
          receivedMessages = msgs
          return true
        },
        fakeNode("ok", "ok"),
      ],
    ])

    const messages = [
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ]
    await node(messages, ctx)

    expect(receivedMessages).toEqual([
      { role: "user", content: "hello" },
      { role: "assistant", content: "hi" },
    ])
  })

  test("works as simple if/else with two cases", async () => {
    const ctx = createMockContext()
    const node = branch<{ approved: boolean }>([
      [(o) => o.approved, fakeNode("approved", "Looks good!")],
      [(o) => !o.approved, fakeNode("rejected", "Needs work")],
    ])

    const messages = [{ role: "reviewer", content: "false", data: { approved: false } }]
    const result = await node(messages, ctx)

    expect(result).toEqual([{ role: "rejected", content: "Needs work", data: undefined }])
  })

  test("stops at first matching predicate and skips rest", async () => {
    const ctx = createMockContext()
    const calls: string[] = []

    const tracked = (label: string): typeof fakeNode => {
      return (role: string, content: string) => {
        const inner = fakeNode(role, content)
        return async (msgs, c) => {
          calls.push(label)
          return inner(msgs, c)
        }
      }
    }

    const node = branch<{ value: number }>([
      [(o) => o.value > 0, tracked("first")("pos", "positive")],
      [(o) => o.value > -100, tracked("second")("also-pos", "also matches")],
    ])

    const messages = [{ role: "test", content: "5", data: { value: 5 } }]
    await node(messages, ctx)

    expect(calls).toEqual(["first"])
  })
})
