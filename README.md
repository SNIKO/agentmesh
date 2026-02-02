# agentmesh

Orchestrate AI agents (**GitHub Copilot**, **OpenAI Codex** and more) behind a single unified interface.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

## What to use agentmesh for

Build pipelines and workflows using multiple agent providers to maximize results.

Different agents have different strengths. Combine them seamlessly:

- **OpenAI Codex** can is strong at deep reasoning, but slow
- **GitHub Copilot** is fast, cost-effective, and offers a wide variety of models
- **Claude Code** is great but sometimes can be too verbose
- **OpenCode** is an open-source alternative with unique capabilities and huge variety of models with some available for free

With `agentmesh`, you can switch providers on the fly using a consistent API. It uses official provider SDKs to utilize their agents

**Note**: Provider CLIs must be installed and authenticated on your machine.

```typescript
import { createAgent } from "agentmesh";
import type { Message } from "agentmesh";
import { z } from "zod";

const feature = "Add a dark mode toggle";

const coderSmart = createAgent({
  provider: "claude",
  model: "opus-4.5",
  cwd: "/path/to/project",
});

const reviewer = createAgent({
  provider: "codex",
  model: "gpt-5.2-codex-max",
  cwd: "/path/to/project",
});

const coderDecent = createAgent({
  provider: "copilot",
  model: "gemini-3-pro",
  cwd: "/path/to/project",
});

const reviewSchema = z.object({
  approve: z.boolean().describe("Whether the changes are approved"),
  feedback: z.string().describe("Review feedback, if any"),
});

const messages: Message[] = [];

// 1) Implement the feature
messages.push({ role: "user", content: `You are a strong coder. Implement the feature:\n${feature}` });
const coderResult1 = await coderSmart.run({ messages });
messages.push({ role: "coder", content: coderResult1 });

// 2) Ralph Wiggum loop
while (true) {  
  messages.push({ role: "user", content: "You are a strict code reviewer. Review the changes." });
  const reviewResult = await reviewer.run({ messages, outputSchema: reviewSchema });
  if (reviewResult.approve) {
    break;
  }

  messages.push({ role: "reviewer", content: `Review feedback:\n\n${reviewResult.feedback}` });
  messages.push({ role: "user", content: "Address the review feedback and update the code." });

  const coderResult2 = await coderDecent.run({ messages });
  messages.push({ role: "coder", content: coderResult2 });
}

```

## Features

### Structured Output

Use Zod schemas to get type-safe, validated responses:

```typescript
import { createAgent } from "agentmesh";
import { z } from "zod";

const agent = createAgent({
  provider: "codex",
  model: "gpt-5.2-codex-max",
  cwd: "/path/to/project",
});

const fileAnalysis = z.object({
  files: z.array(z.string()),
  totalLines: z.number(),
  languages: z.array(z.string()),
});

const output = await agent.run({
  messages: [{ role: "user", content: "Analyze the src/ directory" }],
  outputSchema: fileAnalysis,
});

// output is typed as { files: string[], totalLines: number, languages: string[] }
console.log(output.files);
```

### MCP Server Integration

By default, providers load MCP server configuration from your local config (project-level and user-level). You can also specify it manually:

```typescript
const agent = createAgent({
  provider: "copilot",
	model: "gpt-5.2",
  mcpServers: {
    database: {
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
      env: { DATABASE_URL: process.env.DATABASE_URL },
    },
    api: {
      type: "http",
      url: "https://mcp.example.com",
      headers: { Authorization: `Bearer ${token}` },
    },
  },
});
```

**Note**: The Codex provider does not support configuring MCP servers via `mcpServers` yet; it always uses the global/local config.

### Event Streaming

`agent.run()` returns a `RunHandle` that is both:

- **Async-iterable** (stream `AgentEvent` objects)
- **Awaitable** (resolve to the final output)

#### Example: stream events and then await the final output

```ts
import { createAgent } from "agentmesh";
import type { AgentEvent } from "agentmesh";

const agent = createAgent({ provider: "copilot", model: "gpt-5.2" });

const handle = agent.run({
  messages: [{ role: "user", content: "Research AMD stock" }],
  streaming: true,
});

for await (const event of handle) {
  onEvent(event);
}

const output = await handle;
console.log("final output:", output);

function onEvent(event: AgentEvent) {
  switch (event.type) {
    case "message.delta":
      process.stdout.write(event.data.delta);
      break;

    case "tool.started":
      console.log("\ntool started:", event.data.name);
      break;

    case "error":
      console.error("\nerror:", event.data.code, event.data.message);
      break;
  }
}
```

#### All events

These are the currently exported `AgentEvent` variants:

- `raw` — provider-specific raw event passthrough (only if `emitRawEvents: true`)
- `message.delta` — incremental assistant message text
- `message.completed` — completed assistant message
- `reasoning.delta` — incremental reasoning text (provider-dependent)
- `reasoning.completed` — completed reasoning content (provider-dependent)
- `tool.started` — tool invocation started (builtin or MCP)
- `tool.progress` — tool progress updates
- `tool.completed` — tool invocation completed (success or error)
- `file.changed` — file system changes detected/recorded
- `stats.updated` — updated run statistics (tokens/cost/duration)
- `error` — an error emitted by the adapter/runtime

### Stats

Stats are emitted as `stats.updated` events. The payload is an `AgentStats` object:

- `tokens.input`, `tokens.output`, `tokens.total`
- `context.contextSize`, `context.usedTokens`
- `costUsd`
- `durationMs`

#### Example: collect final stats

```ts
import { createAgent } from "agentmesh";
import type { AgentStats } from "agentmesh";

const agent = createAgent({ provider: "copilot", model: "gpt-5.2" });

let lastStats: AgentStats | undefined;

const handle = agent.run({
  messages: [{ role: "user", content: "Compare AMD to NVDA" }],
  streaming: true,
});

for await (const event of handle) {
  if (event.type === "stats.updated") lastStats = event.data;
}

await handle;
console.log("stats:", lastStats);
```

**Note**: It is not fully supported by all providers yet due to SDK limitations. For example, Codex emmits only token usage stats and only on run completion.

## License

MIT © Sergii Vashchyshchuk
