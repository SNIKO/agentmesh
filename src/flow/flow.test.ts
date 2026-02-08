/**
 * Integration tests for flow.run() — complex, real-world pipelines through the public API.
 * All agents are mocked; these verify:
 *
 *   1. Message flow: final result.messages contains only user input + node outputs
 *   2. No leakage: internal prompt/system/audit messages used by nodes stay hidden
 *      - Agent prompts (sent as role:"user" to the LLM) must not appear in result
 *      - Consensus fork agents' responses (used as jury context) must not appear
 *   3. Context passing: each successive agent receives the correct accumulated context
 *   4. Stats tracking: all agents are tracked regardless of nesting depth
 *   5. Event stream: lifecycle events follow correct ordering
 *   6. Error handling: failures propagate as FlowError with correct node context
 */
import { describe, expect, mock, test } from "bun:test"
import { FlowError } from "./errors.ts"
import { flow } from "./flow.ts"
import { mockCreateAgent } from "./test-helpers.ts"
import type { FlowEvent } from "./types.ts"

// ============================================
// HELPERS
// ============================================

function setupMock(responses: Record<string, string | import("./test-helpers").MockAgentBehavior>) {
  const mockCreate = mockCreateAgent(responses)
  mock.module("../agents", () => ({
    createAgent: mockCreate,
  }))
  return mockCreate
}

async function collectEvents(handle: ReturnType<typeof flow.run>): Promise<FlowEvent[]> {
  const events: FlowEvent[] = []
  for await (const event of handle) {
    events.push(event)
  }
  return events
}

// ============================================
// 1. Chain + Fork: multi-stage analysis pipeline
//    Tests: chain accumulation, fork parallelism, message ordering,
//           context passing between stages, no prompt leakage
// ============================================

describe("chain + fork: multi-stage analysis pipeline", () => {
  test("planner → fork(security, perf) → synthesizer: correct message flow and context passing", async () => {
    let synthesizerInput: Array<{ role: string; content: string }> = []

    setupMock({
      "claude:opus-4": "Plan: 1. Audit auth 2. Profile hot paths 3. Check deps",
      "copilot:gpt-5": "No critical vulns. Minor: use parameterized queries in db.ts",
      "claude:sonnet-4": "3 bottlenecks: N+1 in users.ts, missing index, unoptimized images",
      "copilot:gemini-3-pro": {
        output: "Report: secure with minor SQL fix needed, 3 perf issues to address",
        captureMessages: (msgs) => {
          synthesizerInput = msgs
        },
      },
    })

    const pipeline = flow.chain([
      flow.agent("planner", "Create a security and performance review plan", "claude:opus-4"),
      flow.fork([
        flow.agent("security", "Analyze for security vulnerabilities", "copilot:gpt-5"),
        flow.agent("performance", "Analyze for performance bottlenecks", "claude:sonnet-4"),
      ]),
      flow.agent("synthesizer", "Combine all findings into a final report", "copilot:gemini-3-pro"),
    ])

    const result = await flow.run(pipeline, "Review src/app.ts")

    // Final messages: user + planner + security + performance + synthesizer
    expect(result.messages).toHaveLength(5)
    expect(result.messages.map((m) => m.role)).toEqual([
      "user",
      "planner",
      "security",
      "performance",
      "synthesizer",
    ])

    // Content flows through correctly
    expect(result.messages[0].content).toBe("Review src/app.ts")
    expect(result.messages[1].content).toContain("Audit auth")
    expect(result.messages[2].content).toContain("vulns")
    expect(result.messages[3].content).toContain("bottlenecks")
    expect(result.messages[4].content).toContain("Report")

    // No internal prompt messages leaked — only the user's original input appears as "user"
    const userMessages = result.messages.filter((m) => m.role === "user")
    expect(userMessages).toHaveLength(1)
    expect(userMessages[0].content).toBe("Review src/app.ts")

    // Synthesizer received full accumulated context: prior outputs + its own prompt
    // Messages sent to the LLM: [user, planner, security, performance, prompt]
    expect(synthesizerInput.map((m) => m.role)).toEqual([
      "user",
      "planner",
      "security",
      "performance",
      "user", // synthesizer's prompt (internal, not in final result)
    ])

    // Stats tracked all 4 agents
    expect(result.stats.agents).toHaveLength(4)
    expect(result.stats.totals.tokensUsed).toBe(120) // 4 agents × 30 tokens each
  })
})

// ============================================
// 2. Consensus: internal fork messages hidden
//    Tests: consensus encapsulates deliberation — only the jury verdict
//           appears in final messages, individual expert responses are hidden
// ============================================

describe("consensus: jury verdict only", () => {
  test("chain → consensus → writer: fork agents' messages do not leak into result", async () => {
    setupMock({
      "claude:opus-4": "Research: module uses event-driven architecture with pub/sub patterns",
      "copilot:gpt-5": "Expert opinion: solid design, consider error boundaries at edges",
      "claude:sonnet-4": "Expert opinion: good separation of concerns, needs structured logging",
      "copilot:gemini-3-pro":
        "Verdict: well-designed event system, add error boundaries and logging",
      "claude:haiku-3":
        "Article: Building Resilient Event Systems — best practices from our review",
    })

    const pipeline = flow.chain([
      flow.agent("researcher", "Research the codebase architecture", "claude:opus-4"),
      flow.consensus({
        role: "expert",
        prompt: "Evaluate the architecture quality",
        agents: ["copilot:gpt-5", "claude:sonnet-4"],
        jury: "copilot:gemini-3-pro",
      }),
      flow.agent(
        "writer",
        "Write a summary article based on the expert analysis",
        "claude:haiku-3",
      ),
    ])

    const result = await flow.run(pipeline, "Analyze our system architecture")

    // Only the jury's message appears as "expert" — the two fork experts are hidden
    expect(result.messages).toHaveLength(4)
    expect(result.messages.map((m) => m.role)).toEqual(["user", "researcher", "expert", "writer"])

    // Internal consensus agent messages must not leak
    const roles = new Set(result.messages.map((m) => m.role))
    expect(roles.has("expert_1")).toBe(false)
    expect(roles.has("expert_2")).toBe(false)

    // Jury's content (not the individual experts') appears as the "expert" message
    expect(result.messages[2].content).toContain("Verdict")

    // All 5 agents still tracked in stats (researcher + 2 consensus fork + jury + writer)
    expect(result.stats.agents).toHaveLength(5)
  })
})

// ============================================
// 3. Branch + Loop: conditional routing with iteration
//    Tests: branch routes to correct path based on prior output,
//           loop accumulates messages across iterations,
//           unmatched branch agents don't run
// ============================================

describe("branch + loop: conditional iteration", () => {
  test("classifier → branch(loop(refiner) | approver): takes loop path and accumulates", async () => {
    setupMock({
      "copilot:gpt-5": "Status: needs_work — several issues found in the implementation",
      "claude:opus-4": "Refined: fixed null check and added input validation",
    })

    const pipeline = flow.chain([
      flow.agent("classifier", "Classify the code quality", "copilot:gpt-5"),
      flow.branch([
        [
          (_, msgs) => msgs.at(-1)?.content.includes("needs_work") ?? false,
          flow.loop({
            work: flow.agent("refiner", "Refine and fix the code", "claude:opus-4"),
            until: (_, msgs) => msgs.filter((m) => m.role === "refiner").length >= 3,
            maxIterations: 5,
          }),
        ],
        [() => true, flow.agent("approver", "Approve the code", "claude:sonnet-4")],
      ]),
    ])

    const result = await flow.run(pipeline, "Review my pull request")

    // Branch takes "needs_work" path → loop runs refiner 3 times then stops
    expect(result.messages).toHaveLength(5) // user + classifier + 3 refiners
    expect(result.messages.map((m) => m.role)).toEqual([
      "user",
      "classifier",
      "refiner",
      "refiner",
      "refiner",
    ])

    // All refiner iterations produced the same (mocked) output
    const refinerMessages = result.messages.filter((m) => m.role === "refiner")
    expect(refinerMessages).toHaveLength(3)
    expect(refinerMessages.every((m) => m.content.includes("fixed null check"))).toBe(true)

    // Approver should NOT have run (branch took the other path)
    expect(result.messages.map((m) => m.role)).not.toContain("approver")

    // Only one user message
    expect(result.messages.filter((m) => m.role === "user")).toHaveLength(1)

    // Stats: classifier + 3 refiner iterations = 4 agents
    expect(result.stats.agents).toHaveLength(4)
  })
})

// ============================================
// 4. Error propagation in deeply nested pipeline
//    Tests: error from a fork child surfaces as FlowError with correct node,
//           chain stops (doesn't run subsequent nodes),
//           event stream captures the failure lifecycle
// ============================================

describe("error propagation in nested pipeline", () => {
  test("chain(agent → fork(ok, fail) → agent): FlowError with correct context, deployer never runs", async () => {
    setupMock({
      "claude:opus-4": "Step 1 complete: analysis ready",
      "copilot:gpt-5": "Lint check passed",
      "claude:sonnet-4": { output: "", error: new Error("API rate limit exceeded") },
      "copilot:gemini-3-pro": "Should never run",
    })

    const pipeline = flow.chain([
      flow.agent("analyzer", "Analyze the code", "claude:opus-4"),
      flow.fork([
        flow.agent("linter", "Run lint checks", "copilot:gpt-5"),
        flow.agent("typechecker", "Run type checks", "claude:sonnet-4"),
      ]),
      flow.agent("deployer", "Deploy if all checks pass", "copilot:gemini-3-pro"),
    ])

    const handle = flow.run(pipeline, "Deploy main branch")
    const events = await collectEvents(handle)

    try {
      await handle.result
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(FlowError)
      if (e instanceof FlowError) {
        expect(e.nodeName).toBe("typechecker")
        expect(e.message).toContain("API rate limit exceeded")
        expect(e.agentId.startsWith("run_")).toBe(true)
      }
    }

    // Event stream captured the failure lifecycle
    const types = events.map((e) => e.type)
    expect(types[0]).toBe("flow.started")
    expect(types).toContain("agent.completed") // analyzer completed before failure
    expect(types).toContain("agent.failed") // typechecker failed
    expect(types).toContain("flow.failed")
    expect(types).not.toContain("flow.completed") // flow did NOT complete successfully
  })
})

// ============================================
// 5. Event stream ordering on complex pipeline
//    Tests: lifecycle events follow correct ordering — flow.started first,
//           flow.completed last, chain respects sequential ordering,
//           all agent pairs have started+completed, stats emitted throughout
// ============================================

describe("event stream on multi-agent pipeline", () => {
  test("chain → fork: events respect flow and chain ordering", async () => {
    setupMock({
      "claude:opus-4": { output: "Planning done", delay: 10 },
      "copilot:gpt-5": { output: "Security OK", delay: 10 },
      "claude:sonnet-4": { output: "Perf OK", delay: 10 },
    })

    const pipeline = flow.chain([
      flow.agent("planner", "Plan", "claude:opus-4"),
      flow.fork([
        flow.agent("security", "Check security", "copilot:gpt-5"),
        flow.agent("perf", "Check perf", "claude:sonnet-4"),
      ]),
    ])

    const handle = flow.run(pipeline, "Go")
    const events = await collectEvents(handle)
    await handle.result

    const types = events.map((e) => e.type)

    // Flow lifecycle bookends
    expect(types[0]).toBe("flow.started")
    expect(types.at(-1)).toBe("flow.completed")

    // Every agent has a started+completed pair
    const agentStarts = events.filter((e) => e.type === "agent.started")
    const agentCompletes = events.filter((e) => e.type === "agent.completed")
    expect(agentStarts).toHaveLength(3)
    expect(agentCompletes).toHaveLength(3)

    // Chain ordering: planner must complete before fork agents start
    const plannerComplete = events.findIndex(
      (e) => e.type === "agent.completed" && e.data.role === "planner",
    )
    const forkStarts = events
      .map((e, i) => ({ e, i }))
      .filter(
        ({ e }) =>
          e.type === "agent.started" && (e.data.role === "security" || e.data.role === "perf"),
      )
      .map(({ i }) => i)

    expect(forkStarts).toHaveLength(2)
    for (const idx of forkStarts) {
      expect(idx).toBeGreaterThan(plannerComplete)
    }

    // Stats events emitted throughout the pipeline
    expect(types.filter((t) => t === "flow.stats.updated").length).toBeGreaterThan(0)
  })
})
