import { describe, expect, mock, test } from "bun:test"
import { createMockContext, mockCreateAgent } from "../test-helpers.ts"

describe("consensus", () => {
  test("uses provided role for agent roles and builds default jury prompt", async () => {
    let juryMessages: Array<{ role: string; content: string; data?: unknown }> = []

    const mockCreate = mockCreateAgent({
      "copilot:agent-a": "Finding A",
      "copilot:agent-b": "Finding B",
      "copilot:jury": {
        output: "Verdict",
        captureMessages: (msgs) => {
          juryMessages = msgs
        },
      },
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { consensus } = await import("./node-consensus")
    const ctx = createMockContext()

    const node = consensus({
      role: "investigator",
      prompt: "Analyze the issue",
      agents: ["copilot:agent-a", "copilot:agent-b"],
      jury: "copilot:jury",
    })

    const result = await node([{ role: "user", content: "Prev flow messages" }], ctx)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe("investigator")
    expect(result[0].content).toBe("Verdict")

    expect(juryMessages).toEqual([
      { role: "user", content: "Prev flow messages" },
      { role: "user", content: "Analyze the issue", data: undefined },
      { role: "investigator_1", content: "Finding A", data: undefined },
      { role: "investigator_2", content: "Finding B", data: undefined },
      {
        role: "user",
        content: `You are the master investigator. Synthesize responses from 2 investigators into a single answer for the user.
Prioritize facts where multiple investigators agree and present them confidently.
Call out points without agreement or unclear evidence as "not sure".
Reflect confidence based on how many investigators align.`,
      },
    ])
  })

  test("skips jury and runs single agent directly when only one agent", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:solo": "Solo output",
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { consensus } = await import("./node-consensus")
    const ctx = createMockContext()

    const node = consensus({
      role: "analyst",
      prompt: "Inspect",
      agents: ["copilot:solo"],
      jury: "copilot:jury",
    })

    const result = await node([{ role: "user", content: "Analyze", data: undefined }], ctx)

    expect(result).toEqual([{ role: "analyst", content: "Solo output" }])
  })

  test("accepts custom juryPrompt with multiple agents", async () => {
    let juryMessages: Array<{ role: string; content: string; data?: unknown }> = []

    const mockCreate = mockCreateAgent({
      "copilot:agent-a": "Agent A notes",
      "copilot:agent-b": "Agent B notes",
      "copilot:jury": {
        output: "Custom final",
        captureMessages: (msgs) => {
          juryMessages = msgs
        },
      },
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { consensus } = await import("./node-consensus")
    const ctx = createMockContext()

    const node = consensus({
      role: "reviewer",
      prompt: "Review",
      agents: ["copilot:agent-a", "copilot:agent-b"],
      jury: "copilot:jury",
      juryPrompt: "Combine reviewer opinions thoughtfully.",
    })

    const result = await node([{ role: "user", content: "Prev flow messages" }], ctx)

    expect(result).toEqual([{ role: "reviewer", content: "Custom final" }])

    expect(juryMessages).toEqual([
      { role: "user", content: "Prev flow messages" },
      { role: "user", content: "Review", data: undefined },
      { role: "reviewer_1", content: "Agent A notes", data: undefined },
      { role: "reviewer_2", content: "Agent B notes", data: undefined },
      {
        role: "user",
        content: "Combine reviewer opinions thoughtfully.",
      },
    ])
  })
})
