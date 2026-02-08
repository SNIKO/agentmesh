# Flow Pipelines Design

**Date:** 2026-02-07  
**Status:** v3

Declarative pipeline system for composing agents into execution graphs.  
One mental model: **messages in → new messages out**. Every node is a function.

---

## What It Solves

The SDK handles single agent runs. Real workflows need multiple agents — sequentially, in parallel, in loops.
Today developers manually maintain `Message[]`, push/parse between calls, and handle parallelism.
The flow system removes that boilerplate — declare *what*, the library handles *how*.

```ts
const pipeline = flow.chain([
  flow.agent("coder", "Implement the feature", "claude:opus-4.5"),
  flow.loop({
    work: flow.chain([
      flow.agent("reviewer", "Review the changes", "codex:gpt-5.2", { outputSchema: reviewSchema }),
      flow.when((output) => !output.approved, flow.agent("fixer", "Fix the feedback", "copilot:gemini-3-pro")),
    ]),
    until: (output) => output.approved,
    maxIterations: 5,
  }),
]);

const result = await flow.run(pipeline, "Add dark mode toggle");
```

---

## Core Types

### Message (extended from SDK)

```ts
export interface Message<T = unknown> {
  role: string;      // "user", "assistant", "system", or agent name ("reviewer", "coder")
  content: string;   // always present — raw JSON string when outputSchema is used
  data?: T;          // parsed structured output when agent uses outputSchema
}
```

### FlowNode

Every builder returns this. Every composite accepts this. Custom nodes are just functions.

```ts
export type FlowNode = (messages: Message[], ctx: FlowContext) => Promise<Message[]>;
```

A node receives all prior messages and returns only **new** messages.
The parent node merges them into the conversation before passing to the next child.

### FlowContext (internal)

Created by `flow.run()`, threaded through nodes. Consumers never construct this.

```ts
export interface FlowContext {
  flowId: string;
  input: string;                        // original user input
  defaultAgent?: string;                // "provider:model" fallback
  cwd?: string;
  signal?: AbortSignal;
  emit: (event: FlowEvent) => void;
  tracker: FlowTracker;
}
```

### FlowResult & FlowHandle

```ts
export interface FlowResult<T = unknown> {
  messages: Message[];   // full conversation (initial + all node outputs)
  output?: T;            // data from last message with outputSchema
  stats: FlowLiveStats;  // final live stats snapshot when the flow completes
}

// Same dual-mode pattern as SDK's RunHandle
export type FlowHandle<T = unknown> = Promise<FlowResult<T>> & {
  [Symbol.asyncIterator](): AsyncGenerator<FlowEvent, void>;
  result: Promise<FlowResult<T>>;
  abort(): void;
};

// Flow has its own event stream so consumers can observe *live* tracking updates.
// It wraps/proxies the underlying AgentEvent stream(s) and adds flow-level lifecycle + stats updates.
export type FlowEvent =
  | {
      type: "flow.started";
      timestamp: number;
      data: { flowId: string; input: string };
    }
  | {
      type: "flow.completed";
      timestamp: number;
      data: { flowId: string };
    }
  | {
      type: "flow.failed";
      timestamp: number;
      data: { flowId: string; error: string };
    }
  | {
      type: "agent.started";
      timestamp: number;
      data: {
        flowId: string;
        agentId: string; // unique per run
        role: string;
        provider: string;
        model: string;
      };
    }
  | {
      type: "agent.completed";
      timestamp: number;
      data: {
        flowId: string;
        agentId: string;
        role: string;
        provider: string;
        model: string;
      };
    }
  | {
      type: "agent.failed";
      timestamp: number;
      data: {
        flowId: string;
        agentId: string;
        role: string;
        provider: string;
        model: string;
        error: string;
      };
    }
  | {
      type: "agent.event";
      timestamp: number;
      data: {
        flowId: string;
        agentId: string;
        role: string;
        provider: string;
        model: string;
        event: AgentEvent;
      };
    }
  | {
      type: "flow.stats.updated";
      timestamp: number;
      data: { flowId: string; live: FlowLiveStats };
    };
```

---

## Nodes

All nodes are `FlowNode`. The difference is what they return.

| Node | Returns | Description |
|------|---------|-------------|
| `agent` | 1 message | Runs one agent |
| `chain` | N messages | Sequential — each child sees prior outputs |
| `fork` | N messages | Concurrent — all branches see same input |
| `when` | 0–N messages | Conditional — runs chosen branch |
| `loop` | N×M messages | Iterative — accumulates across iterations |
| `consensus` | 1 message | Fork voters → jury synthesizes |

### flow.agent()

```ts
flow.agent(role: string, prompt: string, agent?: AgentLike, options?: AgentNodeOptions): FlowNode;

type AgentLike = string | AgentConfig | Agent;

interface AgentNodeOptions<T = unknown> {
  outputSchema?: z.ZodSchema<T>;
}
```

Returns `[{ role, content: response, data?: parsedOutput }]`.
When `outputSchema` is provided, response is parsed with Zod and stored in `data`.

- Pass a string (`"provider:model"`) for the simple path (backward compatible).
- Pass an `AgentConfig` to configure MCP servers/env/providerOptions per node.
- Pass an `Agent` instance when you need a pre-wired agent (e.g., custom MCP setup); events use `defaultAgent` as the label when provided, otherwise `"custom-agent"`.

### flow.chain()

```ts
flow.chain(nodes: FlowNode[]): FlowNode;
```

```ts
async (messages, ctx) => {
  let accumulated: Message[] = [];
  for (const node of nodes) {
    const newMsgs = await node([...messages, ...accumulated], ctx);
    accumulated.push(...newMsgs);
  }
  return accumulated;
};
```

```
chain([A, B, C])  with [userMsg]
  A([userMsg])                → [msgA]
  B([userMsg, msgA])          → [msgB]
  C([userMsg, msgA, msgB])    → [msgC]
  → [msgA, msgB, msgC]
```

### flow.fork()

```ts
flow.fork(nodes: FlowNode[]): FlowNode;
```

```ts
async (messages, ctx) => {
  const results = await Promise.all(nodes.map(n => n(messages, ctx)));
  return results.flat();
};
```

All branches get the same snapshot. Fail-fast — one failure aborts all via AbortSignal.

### flow.when()

```ts
flow.when<T>(predicate: (output: T, messages: Message[]) => boolean, then: FlowNode, otherwise?: FlowNode): FlowNode;
```

```ts
async (messages, ctx) => {
  const output = messages.at(-1)?.data;
  if (predicate(output, messages)) return then(messages, ctx);
  return otherwise ? otherwise(messages, ctx) : [];
};
```

Inspects the **last message's** `data` — the preceding agent must use `outputSchema`.

### flow.loop()

```ts
flow.loop<T>(config: { work: FlowNode; until: (output: T, messages: Message[]) => boolean; maxIterations?: number }): FlowNode;
```

```ts
async (messages, ctx) => {
  const max = config.maxIterations ?? 10;
  let accumulated: Message[] = [];
  for (let i = 0; i < max; i++) {
    const newMsgs = await config.work([...messages, ...accumulated], ctx);
    accumulated.push(...newMsgs);
    const output = [...messages, ...accumulated].at(-1)?.data;
    if (config.until(output as T, [...messages, ...accumulated])) break;
  }
  return accumulated;
};
```

### flow.consensus()

```ts
flow.consensus(config: { prompt: string; voters: AgentLike[]; jury: AgentLike; juryPrompt?: string }): FlowNode;
```

Forks voters (concurrent, same input), then jury sees all voter messages and synthesizes.
Returns only the jury's message — voters are visible via events/tracker but not in output.

---

## Execution

```ts
flow.run<T>(node: FlowNode, input: string, options?: FlowOptions): FlowHandle<T>;

interface FlowOptions {
  defaultAgent?: AgentLike;         // fallback agent (string | AgentConfig | Agent)
  messages?: Message[];             // seed messages
  cwd?: string;
  signal?: AbortSignal;
  timeout?: number;
}
```

1. Creates `[...options.messages, { role: "user", content: input }]`
2. Creates `FlowContext`, calls `node(messages, ctx)`
3. Returns `FlowResult` with full conversation, last `data` as `output`, aggregated stats

Agent IDs can still be a `"provider:model"` shorthand: `"copilot:gpt-5.2"` → `createAgent({ provider: "copilot", model: "gpt-5.2" })`. Passing an `AgentConfig` (with MCP servers, env, providerOptions) or an `Agent` instance gives per-node control without changing node composition.

---

## Full Example: Review Loop

```ts
const reviewSchema = z.object({ approved: z.boolean(), feedback: z.string() });

const pipeline = flow.chain([
  flow.agent("coder", "Implement the feature", "claude:opus-4.5"),
  flow.loop<z.infer<typeof reviewSchema>>({
    work: flow.chain([
      flow.agent("reviewer", "Review the code", "copilot:gpt-5.2", { outputSchema: reviewSchema }),
      flow.when((o) => !o.approved, flow.agent("fixer", "Fix the feedback", "copilot:gemini-3-pro")),
    ]),
    until: (o) => o.approved,
    maxIterations: 5,
  }),
]);
```

---

## Tracking

Consumers need to know when stats change, so tracking is driven by the **flow async event stream**.
Agent nodes proxy their underlying `AgentEvent`s into the flow runtime, which maintains an internal `FlowTracker` and emits `flow.stats.updated` whenever the live snapshot changes.
`FlowTracker` is **not** exposed to consumers — the event stream is the only public API for observing live stats.

Usage pattern (same as agent handles):

```ts
const handle = flow.run(pipeline, "Add dark mode toggle")

for await (const event of handle) {
  if (event.type === "flow.stats.updated") {
    // event.data.live is a point-in-time snapshot
    renderStats(event.data.live)
  }
}

const result = await handle
```

Internal state (not exported — used by `flow.run()` to accumulate stats and emit events):

```ts
interface FlowTracker {
  flowId: string;
  input: string;
  status: "running" | "completed" | "failed";
  live: FlowLiveStats;
}

interface FlowLiveStats {
  runningAgents: number;
  agents: ReadonlyArray<{
    agentId: string; // unique per run (loops/forks can run the same role multiple times)
    role: string;
    provider: string;
    model: string;
    status: "running" | "completed" | "failed";
    latestStats?: AgentStats; // latest snapshot from this agent-run's `stats.updated`
  }>;
  totals: {
    toolsUsed: number;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
  };
}
```

Aggregation rules (initial pass):

- Each agent run emits `stats.updated` events containing that agent run’s **current accumulated totals** (not deltas).
- The flow runtime stores **only the latest snapshot per agent-run** (keyed by `agentId`).
- Flow live totals are derived by summing the latest snapshot from *every* started agent-run:
  - `tokensUsed`: sum of `latestStats.tokens.total` (treat missing as 0)
  - `costUsd`: sum of `latestStats.costUsd` (treat missing as 0)
  - `durationMs`: sum of `latestStats.durationMs` (treat missing as 0)
- `toolsUsed` is tracked independently:
  - increment on every proxied `agent.event` whose inner event is `tool.started`
  - do **not** sum tools from agent stats (agents don’t report tool counts today, and stats are snapshots)

This design avoids double-counting: because agent stats are accumulated snapshots, the flow must sum the **latest** per agent-run (not sum every `stats.updated` event).

This keeps tracking lightweight while still answering: “what’s running?”, “what ran?”, and “how big/expensive is the flow so far?”.

---

## Error Handling

```ts
export class FlowError extends Error {
  constructor(
    message: string,
    public readonly nodeName: string,
    public readonly agentId: string,
    public readonly cause?: Error,
    public readonly partialMessages?: Message[],
  ) { super(message); this.name = "FlowError"; }
}
```

Fail immediately by default. Fork: fail-fast via AbortSignal.
`partialMessages` carries messages accumulated before failure. No built-in retry — use `loop()`.

---

## Implementation

```
src/flow/
  index.ts      // flow namespace + run()
  types.ts      // FlowNode, FlowContext, FlowResult, FlowOptions
  nodes.ts      // all 6 node implementations
  tracker.ts    // FlowTracker (pipeline-level live stats)
  errors.ts     // FlowError
```

**Phases:** 1) agent + chain + run  2) fork  3) when + loop + consensus  4) polish

**SDK change:** Add `data?: T` to `Message` (backward-compatible).
