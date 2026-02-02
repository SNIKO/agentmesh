# Codex SDK Comprehensive Analysis

**Package**: `@openai/codex-sdk`  
**Repository**: https://github.com/openai/codex/tree/main/sdk/typescript  
**Runtime**: Node.js 18+

This document provides an exhaustive analysis of all types, interfaces, events, enums, and APIs in the OpenAI Codex SDK.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Client/Thread Types](#2-clientthread-types)
3. [Event System](#3-event-system)
4. [Item Types](#4-item-types)
5. [Configuration Options](#5-configuration-options)
6. [Stats/Usage Tracking](#6-statsusage-tracking)
7. [Turn Management](#7-turn-management)
8. [Enums and Constants](#8-enums-and-constants)
9. [Error Handling](#9-error-handling)
10. [MCP Integration](#10-mcp-integration)
11. [All Exports](#11-all-exports)

---

## 1. Architecture Overview

The Codex SDK wraps the bundled `codex` binary CLI. It spawns the CLI process and exchanges JSONL events over stdin/stdout.

### Core Components

```
┌─────────────────────┐
│      Codex          │  Main entry point
├─────────────────────┤
│   - startThread()   │  Create new conversation
│   - resumeThread()  │  Resume existing conversation
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│      Thread         │  Conversation thread
├─────────────────────┤
│   - run()           │  Synchronous execution
│   - runStreamed()   │  Streaming execution
│   - id              │  Thread identifier
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│    CodexExec        │  CLI process manager
├─────────────────────┤
│   - run()           │  Spawn CLI process
│   - executablePath  │  Path to binary
└─────────────────────┘
```

### Package Structure

```
src/
├── index.ts           # Main exports
├── codex.ts           # Codex class
├── thread.ts          # Thread class
├── exec.ts            # CLI execution wrapper
├── codexOptions.ts    # Client configuration
├── threadOptions.ts   # Thread configuration
├── turnOptions.ts     # Turn configuration
├── events.ts          # Event type definitions
├── items.ts           # Item type definitions
└── outputSchemaFile.ts # Structured output support
```

---

## 2. Client/Thread Types

### Codex Class

The main entry point for interacting with the Codex agent:

```typescript
class Codex {
  constructor(options?: CodexOptions);
  
  /**
   * Starts a new conversation with an agent.
   * @returns A new thread instance.
   */
  startThread(options?: ThreadOptions): Thread;
  
  /**
   * Resumes a conversation with an agent based on the thread id.
   * Threads are persisted in ~/.codex/sessions.
   * @param id The id of the thread to resume.
   * @returns A new thread instance.
   */
  resumeThread(id: string, options?: ThreadOptions): Thread;
}
```

### CodexOptions

Configuration for creating a `Codex` client:

```typescript
type CodexConfigValue = 
  | string 
  | number 
  | boolean 
  | CodexConfigValue[] 
  | CodexConfigObject;

type CodexConfigObject = { [key: string]: CodexConfigValue };

interface CodexOptions {
  /** Override path to the codex CLI binary */
  codexPathOverride?: string;
  
  /** Base URL for the OpenAI API */
  baseUrl?: string;
  
  /** API key for authentication */
  apiKey?: string;
  
  /**
   * Additional `--config key=value` overrides to pass to the Codex CLI.
   * Provide a JSON object and the SDK will flatten it into dotted paths
   * and serialize values as TOML literals.
   */
  config?: CodexConfigObject;
  
  /**
   * Environment variables passed to the Codex CLI process.
   * When provided, the SDK will not inherit variables from process.env.
   */
  env?: Record<string, string>;
}
```

### Thread Class

Represents a conversation thread with the agent:

```typescript
class Thread {
  /** The unique identifier for this thread (available after first run) */
  get id(): string | null;
  
  /**
   * Provides the input to the agent and returns the completed turn.
   * Buffers all events until the turn finishes.
   */
  async run(input: Input, turnOptions?: TurnOptions): Promise<Turn>;
  
  /**
   * Provides the input to the agent and returns a streaming result.
   * Returns an async generator of structured events for real-time progress.
   */
  async runStreamed(input: Input, turnOptions?: TurnOptions): Promise<StreamedTurn>;
}
```

### Input Types

```typescript
/** An input to send to the agent */
type UserInput =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "local_image";
      path: string;
    };

/** Input can be a simple string or structured entries with images */
type Input = string | UserInput[];
```

### Turn Results

```typescript
/** Completed turn result */
interface Turn {
  /** All items produced during the turn */
  items: ThreadItem[];
  
  /** The final response text from the agent */
  finalResponse: string;
  
  /** Token usage statistics for this turn */
  usage: Usage | null;
}

/** Alias for Turn */
type RunResult = Turn;

/** The result of runStreamed() method */
interface StreamedTurn {
  /** Async generator yielding events as they occur */
  events: AsyncGenerator<ThreadEvent>;
}

/** Alias for StreamedTurn */
type RunStreamedResult = StreamedTurn;
```

---

## 3. Event System

### Event Union Type

All events emitted during thread execution:

```typescript
type ThreadEvent =
  | ThreadStartedEvent
  | TurnStartedEvent
  | TurnCompletedEvent
  | TurnFailedEvent
  | ItemStartedEvent
  | ItemUpdatedEvent
  | ItemCompletedEvent
  | ThreadErrorEvent;
```

### Event Type Strings

```typescript
"thread.started"   // ThreadStartedEvent - New thread created
"turn.started"     // TurnStartedEvent - Turn processing begins
"turn.completed"   // TurnCompletedEvent - Turn finished successfully
"turn.failed"      // TurnFailedEvent - Turn failed with error
"item.started"     // ItemStartedEvent - New item added (in progress)
"item.updated"     // ItemUpdatedEvent - Item state changed
"item.completed"   // ItemCompletedEvent - Item reached terminal state
"error"            // ThreadErrorEvent - Fatal stream error
```

### Detailed Event Payloads

```typescript
/** Emitted when a new thread is started as the first event */
interface ThreadStartedEvent {
  type: "thread.started";
  /** The identifier of the new thread. Can be used to resume later. */
  thread_id: string;
}

/** Emitted when a turn is started by sending a new prompt to the model */
interface TurnStartedEvent {
  type: "turn.started";
  // No additional data
}

/** Emitted when a turn is completed successfully */
interface TurnCompletedEvent {
  type: "turn.completed";
  /** Token usage statistics for this turn */
  usage: Usage;
}

/** Indicates that a turn failed with an error */
interface TurnFailedEvent {
  type: "turn.failed";
  /** Error details */
  error: ThreadError;
}

/** Emitted when a new item is added to the thread (typically in progress) */
interface ItemStartedEvent {
  type: "item.started";
  /** The item that was started */
  item: ThreadItem;
}

/** Emitted when an item is updated */
interface ItemUpdatedEvent {
  type: "item.updated";
  /** The updated item state */
  item: ThreadItem;
}

/** Signals that an item has reached a terminal state (success or failure) */
interface ItemCompletedEvent {
  type: "item.completed";
  /** The completed item */
  item: ThreadItem;
}

/** Represents an unrecoverable error emitted directly by the event stream */
interface ThreadErrorEvent {
  type: "error";
  /** Error message */
  message: string;
}

/** Fatal error emitted by the stream */
interface ThreadError {
  message: string;
}
```

---

## 4. Item Types

### ThreadItem Union Type

All possible item types in a thread:

```typescript
type ThreadItem =
  | AgentMessageItem
  | ReasoningItem
  | CommandExecutionItem
  | FileChangeItem
  | McpToolCallItem
  | WebSearchItem
  | TodoListItem
  | ErrorItem;
```

### Item Type Strings

```typescript
"agent_message"       // AgentMessageItem - Agent's response
"reasoning"           // ReasoningItem - Agent's reasoning summary
"command_execution"   // CommandExecutionItem - Shell command execution
"file_change"         // FileChangeItem - File modifications
"mcp_tool_call"       // McpToolCallItem - MCP tool invocation
"web_search"          // WebSearchItem - Web search request
"todo_list"           // TodoListItem - Agent's task tracking
"error"               // ErrorItem - Non-fatal error
```

### AgentMessageItem

Response from the agent:

```typescript
interface AgentMessageItem {
  id: string;
  type: "agent_message";
  /** Either natural-language text or JSON when structured output is requested */
  text: string;
}
```

### ReasoningItem

Agent's reasoning/thinking summary:

```typescript
interface ReasoningItem {
  id: string;
  type: "reasoning";
  /** The reasoning text */
  text: string;
}
```

### CommandExecutionItem

A command executed by the agent:

```typescript
type CommandExecutionStatus = "in_progress" | "completed" | "failed" | "declined";

interface CommandExecutionItem {
  id: string;
  type: "command_execution";
  /** The command line executed by the agent */
  command: string;
  /** Aggregated stdout and stderr captured while running */
  aggregated_output: string;
  /** Set when the command exits; omitted while still running */
  exit_code?: number;
  /** Current status of the command execution */
  status: CommandExecutionStatus;
}
```

### FileChangeItem

A set of file changes by the agent:

```typescript
type PatchChangeKind = "add" | "delete" | "update";

interface FileUpdateChange {
  /** File path affected */
  path: string;
  /** Type of change */
  kind: PatchChangeKind;
}

type PatchApplyStatus = "in_progress" | "completed" | "failed";

interface FileChangeItem {
  id: string;
  type: "file_change";
  /** Individual file changes that comprise the patch */
  changes: FileUpdateChange[];
  /** Whether the patch ultimately succeeded or failed */
  status: PatchApplyStatus;
}
```

### McpToolCallItem

A call to an MCP (Model Context Protocol) tool:

```typescript
import type { ContentBlock as McpContentBlock } from "@modelcontextprotocol/sdk/types.js";

type McpToolCallStatus = "in_progress" | "completed" | "failed";

interface McpToolCallItem {
  id: string;
  type: "mcp_tool_call";
  /** Name of the MCP server handling the request */
  server: string;
  /** The tool invoked on the MCP server */
  tool: string;
  /** Arguments forwarded to the tool invocation */
  arguments: unknown;
  /** Result payload returned by the MCP server for successful calls */
  result?: {
    content: McpContentBlock[];
    structured_content: unknown;
  };
  /** Error message reported for failed calls */
  error?: {
    message: string;
  };
  /** Current status of the tool invocation */
  status: McpToolCallStatus;
}
```

### WebSearchItem

Captures a web search request:

```typescript
interface WebSearchItem {
  id: string;
  type: "web_search";
  /** The search query */
  query: string;
}
```

### TodoListItem

Tracks the agent's running to-do list:

```typescript
interface TodoItem {
  /** Description of the task */
  text: string;
  /** Whether the task is completed */
  completed: boolean;
}

interface TodoListItem {
  id: string;
  type: "todo_list";
  /** Current list of tasks */
  items: TodoItem[];
}
```

### ErrorItem

Describes a non-fatal error surfaced as an item:

```typescript
interface ErrorItem {
  id: string;
  type: "error";
  /** Error message */
  message: string;
}
```

---

## 5. Configuration Options

### ThreadOptions

Configuration for creating a thread:

```typescript
type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";

type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";

type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

type WebSearchMode = "disabled" | "cached" | "live";

interface ThreadOptions {
  /** Model to use for this thread */
  model?: string;
  
  /** Sandbox mode for command execution */
  sandboxMode?: SandboxMode;
  
  /** Working directory for the thread */
  workingDirectory?: string;
  
  /** Skip the Git repository check */
  skipGitRepoCheck?: boolean;
  
  /** Reasoning effort level for the model */
  modelReasoningEffort?: ModelReasoningEffort;
  
  /** Whether network access is enabled in sandbox */
  networkAccessEnabled?: boolean;
  
  /** Web search mode configuration */
  webSearchMode?: WebSearchMode;
  
  /** Legacy: Enable/disable web search */
  webSearchEnabled?: boolean;
  
  /** Approval policy for command execution */
  approvalPolicy?: ApprovalMode;
  
  /** Additional directories to include */
  additionalDirectories?: string[];
}
```

### TurnOptions

Configuration for a single turn:

```typescript
interface TurnOptions {
  /** JSON schema describing the expected agent output */
  outputSchema?: unknown;
  
  /** AbortSignal to cancel the turn */
  signal?: AbortSignal;
}
```

### CodexExecArgs (Internal)

Arguments passed to the CLI execution:

```typescript
interface CodexExecArgs {
  /** The prompt/input to send */
  input: string;
  
  /** OpenAI API base URL */
  baseUrl?: string;
  
  /** API key for authentication */
  apiKey?: string;
  
  /** Thread ID for resuming (null for new threads) */
  threadId?: string | null;
  
  /** Image paths to attach */
  images?: string[];
  
  /** Model identifier */
  model?: string;
  
  /** Sandbox mode */
  sandboxMode?: SandboxMode;
  
  /** Working directory */
  workingDirectory?: string;
  
  /** Additional directories */
  additionalDirectories?: string[];
  
  /** Skip Git repository check */
  skipGitRepoCheck?: boolean;
  
  /** Path to output schema file */
  outputSchemaFile?: string;
  
  /** Model reasoning effort */
  modelReasoningEffort?: ModelReasoningEffort;
  
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
  
  /** Network access in sandbox */
  networkAccessEnabled?: boolean;
  
  /** Web search mode */
  webSearchMode?: WebSearchMode;
  
  /** Legacy web search toggle */
  webSearchEnabled?: boolean;
  
  /** Approval policy */
  approvalPolicy?: ApprovalMode;
}
```

---

## 6. Stats/Usage Tracking

### Usage Interface

Token usage statistics returned with turn completion:

```typescript
interface Usage {
  /** The number of input tokens used during the turn */
  input_tokens: number;
  
  /** The number of cached input tokens used during the turn */
  cached_input_tokens: number;
  
  /** The number of output tokens used during the turn */
  output_tokens: number;
}
```

### Usage in Events

```typescript
// TurnCompletedEvent includes usage
{
  type: "turn.completed";
  usage: {
    input_tokens: number;
    cached_input_tokens: number;
    output_tokens: number;
  };
}
```

### Usage in Turn Result

```typescript
// Turn result from run()
const turn = await thread.run("prompt");
console.log(turn.usage);
// {
//   input_tokens: 150,
//   cached_input_tokens: 50,
//   output_tokens: 200
// }
```

---

## 7. Turn Management

### Synchronous Execution (run)

Buffers all events and returns the complete result:

```typescript
const codex = new Codex();
const thread = codex.startThread();

const turn = await thread.run("Analyze this code");
// Returns after turn completes

console.log(turn.finalResponse);  // Agent's final message
console.log(turn.items);          // All items produced
console.log(turn.usage);          // Token usage
```

### Streaming Execution (runStreamed)

Returns events as they occur:

```typescript
const { events } = await thread.runStreamed("Analyze this code");

for await (const event of events) {
  switch (event.type) {
    case "item.started":
      console.log("Started:", event.item.type);
      break;
    case "item.updated":
      if (event.item.type === "todo_list") {
        console.log("Tasks:", event.item.items);
      }
      break;
    case "item.completed":
      console.log("Completed:", event.item);
      break;
    case "turn.completed":
      console.log("Usage:", event.usage);
      break;
    case "turn.failed":
      console.error("Failed:", event.error.message);
      break;
  }
}
```

### Structured Output

Force JSON output conforming to a schema:

```typescript
const schema = {
  type: "object",
  properties: {
    summary: { type: "string" },
    status: { type: "string", enum: ["ok", "action_required"] },
  },
  required: ["summary", "status"],
  additionalProperties: false,
} as const;

const turn = await thread.run("Summarize status", { 
  outputSchema: schema 
});

// turn.finalResponse is valid JSON matching schema
const result = JSON.parse(turn.finalResponse);
```

### Cancellation

Use AbortSignal to cancel execution:

```typescript
const controller = new AbortController();

// Cancel after 30 seconds
setTimeout(() => controller.abort(), 30000);

try {
  const turn = await thread.run("Long task", { 
    signal: controller.signal 
  });
} catch (error) {
  if (error.name === 'AbortError') {
    console.log('Task was cancelled');
  }
}
```

### Thread Resumption

Threads persist in `~/.codex/sessions`:

```typescript
// Save thread ID
const thread = codex.startThread();
const turn = await thread.run("Start a task");
const threadId = thread.id;

// Later, resume the thread
const resumedThread = codex.resumeThread(threadId);
await resumedThread.run("Continue the task");
```

---

## 8. Enums and Constants

### Sandbox Modes

```typescript
const SandboxModes = {
  READ_ONLY: "read-only",           // No file writes allowed
  WORKSPACE_WRITE: "workspace-write", // Writes allowed in workspace
  DANGER_FULL_ACCESS: "danger-full-access", // Full system access
} as const;

type SandboxMode = "read-only" | "workspace-write" | "danger-full-access";
```

### Approval Modes

```typescript
const ApprovalModes = {
  NEVER: "never",           // Never ask for approval
  ON_REQUEST: "on-request", // Ask when agent requests
  ON_FAILURE: "on-failure", // Ask only on failures
  UNTRUSTED: "untrusted",   // Always ask for approval
} as const;

type ApprovalMode = "never" | "on-request" | "on-failure" | "untrusted";
```

### Model Reasoning Effort

```typescript
const ModelReasoningEfforts = {
  MINIMAL: "minimal",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  XHIGH: "xhigh",
} as const;

type ModelReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";
```

### Web Search Modes

```typescript
const WebSearchModes = {
  DISABLED: "disabled", // No web search
  CACHED: "cached",     // Use cached results
  LIVE: "live",         // Live web search
} as const;

type WebSearchMode = "disabled" | "cached" | "live";
```

### Command Execution Status

```typescript
const CommandExecutionStatuses = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
  DECLINED: "declined",
} as const;

type CommandExecutionStatus = "in_progress" | "completed" | "failed" | "declined";
```

### Patch Change Kind

```typescript
const PatchChangeKinds = {
  ADD: "add",
  DELETE: "delete",
  UPDATE: "update",
} as const;

type PatchChangeKind = "add" | "delete" | "update";
```

### Patch Apply Status

```typescript
const PatchApplyStatuses = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

type PatchApplyStatus = "in_progress" | "completed" | "failed";
```

### MCP Tool Call Status

```typescript
const McpToolCallStatuses = {
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

type McpToolCallStatus = "in_progress" | "completed" | "failed";
```

### Event Types

```typescript
const EventTypes = {
  THREAD_STARTED: "thread.started",
  TURN_STARTED: "turn.started",
  TURN_COMPLETED: "turn.completed",
  TURN_FAILED: "turn.failed",
  ITEM_STARTED: "item.started",
  ITEM_UPDATED: "item.updated",
  ITEM_COMPLETED: "item.completed",
  ERROR: "error",
} as const;
```

### Item Types

```typescript
const ItemTypes = {
  AGENT_MESSAGE: "agent_message",
  REASONING: "reasoning",
  COMMAND_EXECUTION: "command_execution",
  FILE_CHANGE: "file_change",
  MCP_TOOL_CALL: "mcp_tool_call",
  WEB_SEARCH: "web_search",
  TODO_LIST: "todo_list",
  ERROR: "error",
} as const;
```

---

## 9. Error Handling

### ThreadError

Fatal error structure:

```typescript
interface ThreadError {
  message: string;
}
```

### Error Events

```typescript
// TurnFailedEvent - Turn-level failure
{
  type: "turn.failed";
  error: {
    message: string;
  };
}

// ThreadErrorEvent - Stream-level fatal error
{
  type: "error";
  message: string;
}
```

### ErrorItem

Non-fatal error surfaced as an item:

```typescript
interface ErrorItem {
  id: string;
  type: "error";
  message: string;
}
```

### Error Handling Patterns

```typescript
// Handling errors in run()
try {
  const turn = await thread.run("prompt");
} catch (error) {
  console.error("Turn failed:", error.message);
}

// Handling errors in runStreamed()
const { events } = await thread.runStreamed("prompt");

for await (const event of events) {
  if (event.type === "turn.failed") {
    console.error("Turn failed:", event.error.message);
    break;
  }
  if (event.type === "error") {
    console.error("Stream error:", event.message);
    break;
  }
  if (event.type === "item.completed" && event.item.type === "error") {
    console.warn("Non-fatal error:", event.item.message);
  }
}
```

---

## 10. MCP Integration

### MCP Tool Call Flow

```
item.started (status: in_progress)
    │
    ▼
item.completed (status: completed | failed)
```

### McpToolCallItem States

```typescript
// In progress
{
  type: "mcp_tool_call",
  status: "in_progress",
  server: "server_name",
  tool: "tool_name",
  arguments: { ... },
  result: undefined,
  error: undefined,
}

// Completed successfully
{
  type: "mcp_tool_call",
  status: "completed",
  server: "server_name",
  tool: "tool_name",
  arguments: { ... },
  result: {
    content: [ /* McpContentBlock[] */ ],
    structured_content: { ... },
  },
  error: undefined,
}

// Failed
{
  type: "mcp_tool_call",
  status: "failed",
  server: "server_name",
  tool: "tool_name",
  arguments: { ... },
  result: undefined,
  error: {
    message: "Error description",
  },
}
```

### MCP Content Types

From `@modelcontextprotocol/sdk/types.js`:

```typescript
// Content blocks returned by MCP tools
type McpContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string }
  | { type: "resource"; resource: { uri: string; text?: string; blob?: string } };
```

---

## 11. All Exports

### Type Exports

```typescript
// From events.ts
export type {
  ThreadEvent,
  ThreadStartedEvent,
  TurnStartedEvent,
  TurnCompletedEvent,
  TurnFailedEvent,
  ItemStartedEvent,
  ItemUpdatedEvent,
  ItemCompletedEvent,
  ThreadError,
  ThreadErrorEvent,
  Usage,
} from "./events";

// From items.ts
export type {
  ThreadItem,
  AgentMessageItem,
  ReasoningItem,
  CommandExecutionItem,
  FileChangeItem,
  McpToolCallItem,
  WebSearchItem,
  TodoListItem,
  ErrorItem,
  // Additional
  CommandExecutionStatus,
  PatchChangeKind,
  FileUpdateChange,
  PatchApplyStatus,
  McpToolCallStatus,
  TodoItem,
} from "./items";

// From thread.ts
export type { 
  RunResult, 
  RunStreamedResult, 
  Input, 
  UserInput,
  Turn,
  StreamedTurn,
} from "./thread";

// From codexOptions.ts
export type { 
  CodexOptions,
  CodexConfigValue,
  CodexConfigObject,
} from "./codexOptions";

// From threadOptions.ts
export type {
  ThreadOptions,
  ApprovalMode,
  SandboxMode,
  ModelReasoningEffort,
  WebSearchMode,
} from "./threadOptions";

// From turnOptions.ts
export type { TurnOptions } from "./turnOptions";
```

### Class Exports

```typescript
// Main classes
export { Codex } from "./codex";
export { Thread } from "./thread";
```

---

## Summary: Key Differences from Other SDKs

| Feature | Codex SDK | Copilot SDK | OpenCode SDK | Claude Code SDK |
|---------|-----------|-------------|--------------|-----------------|
| **Architecture** | CLI wrapper (JSONL) | WebSocket/IPC | HTTP/SSE | HTTP/SSE |
| **Threading** | Thread-based | Session-based | Session-based | Conversation-based |
| **Events** | 8 event types | 37+ event types | 50+ event types | 20+ event types |
| **Reasoning** | ReasoningItem | assistant.reasoning | ReasoningPart | Thinking content |
| **MCP Support** | Full | Full | Full | Full |
| **Structured Output** | JSON Schema | JSON Schema | - | - |
| **Web Search** | Built-in | Via tools | - | - |
| **Persistence** | ~/.codex/sessions | Custom | Server-managed | Server-managed |
| **Subagents** | - | Full support | SubtaskPart | - |

### Unique Codex SDK Features

1. **CLI-based Architecture**: Spawns binary process, exchanges JSONL
2. **Web Search Integration**: Native `WebSearchItem` support
3. **Todo List Tracking**: Built-in `TodoListItem` for task management
4. **Sandbox Modes**: Three-tier sandboxing (read-only, workspace-write, full-access)
5. **Reasoning Effort Control**: Fine-grained reasoning effort configuration
6. **Local Image Support**: Native support for attaching local images
