import { beforeEach, describe, expect, mock, test } from "bun:test"
import type { Agent, AgentConfig, AgentEvent, RunHandle } from "../../agents/index.ts"
import { createMockContext, mockCreateAgent } from "../test-helpers.ts"

function createStubRunHandle<T>(output: T, events: AgentEvent[] = []): RunHandle<T> {
  const promise = Promise.resolve(output) as RunHandle<T>
  promise[Symbol.asyncIterator] = async function* () {
    for (const event of events) yield event
  }
  promise.output = promise
  return promise
}

function createStubAgent(
  output: string,
  events: AgentEvent[] = [],
  provider = "custom",
  model = "test-model",
): Agent {
  return {
    provider,
    model,
    run: <T = string>() => createStubRunHandle(output as unknown as T, events),
    close: async () => {},
  }
}

describe("agent node", () => {
  beforeEach(() => {
    // Reset mocks before each test
  })

  test("returns a message with agent name as role", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": "Here is the implementation",
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("coder", "Write some code", "copilot:gpt-5")
    const result = await node([{ role: "user", content: "Build a feature" }], ctx)

    expect(result).toHaveLength(1)
    expect(result[0].role).toBe("coder")
    expect(result[0].content).toBe("Here is the implementation")
  })

  test("emits agent lifecycle events", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": "Done",
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("worker", "Do work", "copilot:gpt-5")
    await node([{ role: "user", content: "Go" }], ctx)

    const eventTypes = ctx.events.map((e) => e.type)
    expect(eventTypes).toEqual([
      "agent.started",
      "flow.stats.updated",
      "agent.event",
      "flow.stats.updated",
      "agent.completed",
      "flow.stats.updated",
    ])
  })

  test("emits agent.failed on error", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": { output: "", error: new Error("API error") },
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("worker", "Do work", "copilot:gpt-5")

    try {
      await node([{ role: "user", content: "Go" }], ctx)
    } catch {}

    const eventTypes = ctx.events.map((e) => e.type)
    expect(eventTypes).toEqual([
      "agent.started",
      "flow.stats.updated",
      "agent.event",
      "flow.stats.updated",
      "agent.failed",
      "flow.stats.updated",
    ])
  })

  test("uses defaultAgent from context when no agentId provided", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": "Default agent response",
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext({ defaultAgent: "copilot:gpt-5" })
    const node = agentNode("worker", "Do work")
    const result = await node([{ role: "user", content: "Go" }], ctx)

    expect(result[0].content).toBe("Default agent response")
  })

  test("throws when no agent and no defaultAgent", async () => {
    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("worker", "Do work")

    expect(node([{ role: "user", content: "Go" }], ctx)).rejects.toThrow("No agent provided")
  })

  test("passes all prior messages plus prompt to agent", async () => {
    let capturedMessages: Array<{ role: string; content: string }> = []

    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": {
        output: "response",
        captureMessages: (msgs) => {
          capturedMessages = msgs
        },
      },
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("coder", "Fix it", "copilot:gpt-5")
    await node(
      [
        { role: "user", content: "Implement dark mode" },
        { role: "coder", content: "Implemented" },
        { role: "reviewer", content: "Dark mode is not working" },
      ],
      ctx,
    )

    expect(capturedMessages).toEqual([
      { role: "user", content: "Implement dark mode" },
      { role: "coder", content: "Implemented" },
      { role: "reviewer", content: "Dark mode is not working" },
      { role: "user", content: "Fix it" },
    ])
  })

  test("accepts AgentConfig objects and passes through to createAgent", async () => {
    const createAgentMock = mock((_: AgentConfig) => createStubAgent("done"))

    mock.module("../../agents", () => ({
      createAgent: createAgentMock,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext({
      cwd: "/workspace",
    })

    const mcpServers = { local: { command: "srv", tools: ["t1"] } }
    const node = agentNode("worker", "Do work", {
      provider: "copilot",
      model: "gpt-5",
      mcpServers,
    })

    await node([{ role: "user", content: "Go" }], ctx)

    expect(createAgentMock).toHaveBeenCalled()
    const firstCall = createAgentMock.mock.calls[0] as unknown[] | undefined
    expect(firstCall?.[0]).toEqual({
      provider: "copilot",
      model: "gpt-5",
      cwd: "/workspace",
      mcpServers,
    })
  })

  test("uses a provided Agent instance without invoking createAgent", async () => {
    const statsEvent: AgentEvent = {
      type: "stats.updated",
      timestamp: Date.now(),
      data: { tokens: { total: 0 } },
    }
    const customAgent = createStubAgent("custom-output", [statsEvent])

    const createAgentMock = mock(() => {
      throw new Error("createAgent should not be called when passing Agent instance")
    })

    mock.module("../../agents", () => ({
      createAgent: createAgentMock,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext({ defaultAgent: "copilot:gpt-5" })
    const node = agentNode("worker", "Do work", customAgent)
    const result = await node([{ role: "user", content: "Go" }], ctx)

    expect(result[0].content).toBe("custom-output")
    expect(createAgentMock.mock.calls.length).toBe(0)

    const started = ctx.events.find((e) => e.type === "agent.started")
    if (started?.type === "agent.started") {
      expect(started.data.provider).toBe("custom")
      expect(started.data.agentId.startsWith("run_")).toBe(true)
    }
  })

  test("updates stats from agent events", async () => {
    const mockCreate = mockCreateAgent({
      "copilot:gpt-5": {
        output: "done",
        events: [
          {
            type: "tool.started",
            timestamp: Date.now(),
            data: { toolId: "t1", name: "read_file", kind: "builtin" },
          },
          {
            type: "stats.updated",
            timestamp: Date.now(),
            data: { tokens: { input: 10, output: 5, total: 15 }, toolCalls: 1 },
          },
        ],
      },
    })

    mock.module("../../agents", () => ({
      createAgent: mockCreate,
    }))

    const { agent: agentNode } = await import("./node-agent")

    const ctx = createMockContext()
    const node = agentNode("worker", "Do work", "copilot:gpt-5")
    await node([{ role: "user", content: "Go" }], ctx)

    const stats = ctx.stats.snapshot()

    expect(stats.totals.toolsUsed).toBe(1)
    expect(stats.agents).toHaveLength(1)
    expect(stats.agents[0].status).toBe("completed")
    expect(stats.agents[0].stats).toEqual({
      tokens: { input: 10, output: 5, total: 15 },
      toolCalls: 1,
    })
  })
})
