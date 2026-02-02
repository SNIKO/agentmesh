# GitHub Copilot SDK - Complete Type Analysis

> **Generated:** February 1, 2026  
> **Package:** `@github/copilot-sdk`  
> **Protocol Version:** 2

## Table of Contents

1. [Package Structure](#package-structure)
2. [Session/Client Types](#1-sessionclient-types)
3. [Event System](#2-event-system-exhaustive)
4. [Tool System](#3-tool-system)
5. [Message Types](#4-message-types)
6. [Reasoning/Thinking](#5-reasoningthinking)
7. [Subagent Support](#6-subagent-support)
8. [Stats/Usage](#7-statsusage)
9. [Enums and Constants](#8-enums-and-constants)
10. [Response Types](#9-response-types)
11. [Hooks System](#10-hooks-system)
12. [MCP Server Configuration](#11-mcp-server-configuration)
13. [Provider Configuration](#12-provider-configuration-byok)

---

## Package Structure

```
dist/
├── index.d.ts              # Main exports
├── client.d.ts             # CopilotClient class
├── session.d.ts            # CopilotSession class
├── types.d.ts              # All type definitions
├── sdkProtocolVersion.d.ts # Protocol version constant
└── generated/
    └── session-events.d.ts # AUTO-GENERATED event types
```

---

## 1. Session/Client Types

### CopilotClientOptions

Configuration for creating a `CopilotClient`:

```typescript
interface CopilotClientOptions {
  /** Path to the Copilot CLI executable. @default "copilot" */
  cliPath?: string;
  
  /** Extra arguments to pass to the CLI executable */
  cliArgs?: string[];
  
  /** Working directory for the CLI process */
  cwd?: string;
  
  /** Port for the CLI server (TCP mode only). @default 0 (random) */
  port?: number;
  
  /** Use stdio transport instead of TCP. @default true */
  useStdio?: boolean;
  
  /** URL of existing CLI server. Format: "host:port", "http://host:port", or "port" */
  cliUrl?: string;
  
  /** Log level for CLI server */
  logLevel?: "none" | "error" | "warning" | "info" | "debug" | "all";
  
  /** Auto-start the CLI server on first use. @default true */
  autoStart?: boolean;
  
  /** Auto-restart the CLI server if it crashes. @default true */
  autoRestart?: boolean;
  
  /** Environment variables to pass to CLI process */
  env?: Record<string, string | undefined>;
  
  /** GitHub token for authentication (takes priority) */
  githubToken?: string;
  
  /** Use logged-in user for authentication. @default true (false when githubToken provided) */
  useLoggedInUser?: boolean;
}
```

### SessionConfig

Configuration for creating a session:

```typescript
interface SessionConfig {
  /** Optional custom session ID */
  sessionId?: string;
  
  /** Model to use (e.g., "gpt-4", "claude-sonnet-4.5") */
  model?: string;
  
  /** Override the default configuration directory location */
  configDir?: string;
  
  /** Tools exposed to the CLI server */
  tools?: Tool<any>[];
  
  /** System message configuration */
  systemMessage?: SystemMessageConfig;
  
  /** List of tool names to allow (takes precedence over excludedTools) */
  availableTools?: string[];
  
  /** List of tool names to disable */
  excludedTools?: string[];
  
  /** Custom provider configuration (BYOK) */
  provider?: ProviderConfig;
  
  /** Handler for permission requests */
  onPermissionRequest?: PermissionHandler;
  
  /** Handler for user input requests (enables ask_user tool) */
  onUserInputRequest?: UserInputHandler;
  
  /** Hook handlers for lifecycle events */
  hooks?: SessionHooks;
  
  /** Working directory for the session */
  workingDirectory?: string;
  
  /** Enable/disable streaming */
  streaming?: boolean;
  
  /** MCP server configurations. Keys are server names */
  mcpServers?: Record<string, MCPServerConfig>;
  
  /** Custom agent configurations */
  customAgents?: CustomAgentConfig[];
  
  /** Directories to load skills from */
  skillDirectories?: string[];
  
  /** List of skill names to disable */
  disabledSkills?: string[];
  
  /** Infinite session configuration */
  infiniteSessions?: InfiniteSessionConfig;
}
```

### ResumeSessionConfig

Configuration for resuming an existing session:

```typescript
type ResumeSessionConfig = Pick<SessionConfig, 
  | "tools" 
  | "provider" 
  | "streaming" 
  | "onPermissionRequest" 
  | "onUserInputRequest" 
  | "hooks" 
  | "workingDirectory" 
  | "mcpServers" 
  | "customAgents" 
  | "skillDirectories" 
  | "disabledSkills"
> & {
  /** Skip emitting session.resume event. @default false */
  disableResume?: boolean;
};
```

### InfiniteSessionConfig

Configuration for automatic context compaction:

```typescript
interface InfiniteSessionConfig {
  /** Whether infinite sessions are enabled. @default true */
  enabled?: boolean;
  
  /** Threshold (0.0-1.0) for background compaction. @default 0.80 */
  backgroundCompactionThreshold?: number;
  
  /** Threshold (0.0-1.0) for blocking until compaction completes. @default 0.95 */
  bufferExhaustionThreshold?: number;
}
```

### ConnectionState

```typescript
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
```

### SessionMetadata

```typescript
interface SessionMetadata {
  sessionId: string;
  startTime: Date;
  modifiedTime: Date;
  summary?: string;
  isRemote: boolean;
}
```

---

## 2. Event System (EXHAUSTIVE)

### Event Base Structure

All events share this base structure:

```typescript
interface SessionEventBase {
  id: string;            // Unique event ID
  timestamp: string;     // ISO timestamp
  parentId: string | null;
  ephemeral?: boolean;   // true = not persisted to session history
}
```

### All Event Types (37 Total)

| Event Type | Ephemeral | Description |
|------------|-----------|-------------|
| `session.start` | No | Session started |
| `session.resume` | No | Session resumed |
| `session.error` | No | Error occurred |
| `session.idle` | **Yes** | Session is idle (finished processing) |
| `session.info` | No | Informational message |
| `session.model_change` | No | Model was changed |
| `session.handoff` | No | Session handoff (remote/local) |
| `session.truncation` | No | Context was truncated |
| `session.snapshot_rewind` | **Yes** | Snapshot rewind occurred |
| `session.usage_info` | **Yes** | Current usage information |
| `session.compaction_start` | No | Compaction started |
| `session.compaction_complete` | No | Compaction finished |
| `user.message` | No | User sent a message |
| `pending_messages.modified` | **Yes** | Pending messages queue changed |
| `assistant.turn_start` | No | Assistant turn started |
| `assistant.intent` | **Yes** | Assistant's detected intent |
| `assistant.reasoning` | No | Complete reasoning content |
| `assistant.reasoning_delta` | **Yes** | Streaming reasoning delta |
| `assistant.message` | No | Complete assistant message |
| `assistant.message_delta` | **Yes** | Streaming message delta |
| `assistant.turn_end` | No | Assistant turn ended |
| `assistant.usage` | **Yes** | Token usage for this call |
| `abort` | No | Request was aborted |
| `tool.user_requested` | No | User requested tool execution |
| `tool.execution_start` | No | Tool execution started |
| `tool.execution_partial_result` | **Yes** | Streaming tool output |
| `tool.execution_progress` | **Yes** | Tool progress message |
| `tool.execution_complete` | No | Tool execution finished |
| `subagent.started` | No | Subagent started |
| `subagent.completed` | No | Subagent completed |
| `subagent.failed` | No | Subagent failed |
| `subagent.selected` | No | Subagent was selected |
| `hook.start` | No | Hook execution started |
| `hook.end` | No | Hook execution ended |
| `system.message` | No | System message injected |

### Detailed Event Payloads

#### Session Events

```typescript
// session.start
{
  type: "session.start";
  data: {
    sessionId: string;
    version: number;
    producer: string;
    copilotVersion: string;
    startTime: string;
    selectedModel?: string;
    context?: {
      cwd: string;
      gitRoot?: string;
      repository?: string;
      branch?: string;
    };
  };
}

// session.resume
{
  type: "session.resume";
  data: {
    resumeTime: string;
    eventCount: number;
    context?: {
      cwd: string;
      gitRoot?: string;
      repository?: string;
      branch?: string;
    };
  };
}

// session.error
{
  type: "session.error";
  data: {
    errorType: string;
    message: string;
    stack?: string;
  };
}

// session.idle (EPHEMERAL)
{
  type: "session.idle";
  ephemeral: true;
  data: {};  // Empty!
}

// session.info
{
  type: "session.info";
  data: {
    infoType: string;
    message: string;
  };
}

// session.model_change
{
  type: "session.model_change";
  data: {
    previousModel?: string;
    newModel: string;
  };
}

// session.handoff
{
  type: "session.handoff";
  data: {
    handoffTime: string;
    sourceType: "remote" | "local";
    repository?: {
      owner: string;
      name: string;
      branch?: string;
    };
    context?: string;
    summary?: string;
    remoteSessionId?: string;
  };
}

// session.truncation
{
  type: "session.truncation";
  data: {
    tokenLimit: number;
    preTruncationTokensInMessages: number;
    preTruncationMessagesLength: number;
    postTruncationTokensInMessages: number;
    postTruncationMessagesLength: number;
    tokensRemovedDuringTruncation: number;
    messagesRemovedDuringTruncation: number;
    performedBy: string;
  };
}

// session.snapshot_rewind (EPHEMERAL)
{
  type: "session.snapshot_rewind";
  ephemeral: true;
  data: {
    upToEventId: string;
    eventsRemoved: number;
  };
}

// session.usage_info (EPHEMERAL)
{
  type: "session.usage_info";
  ephemeral: true;
  data: {
    tokenLimit: number;
    currentTokens: number;
    messagesLength: number;
  };
}

// session.compaction_start
{
  type: "session.compaction_start";
  data: {};  // Empty!
}

// session.compaction_complete
{
  type: "session.compaction_complete";
  data: {
    success: boolean;
    error?: string;
    preCompactionTokens?: number;
    postCompactionTokens?: number;
    preCompactionMessagesLength?: number;
    messagesRemoved?: number;
    tokensRemoved?: number;
    summaryContent?: string;
    compactionTokensUsed?: {
      input: number;
      output: number;
      cachedInput: number;
    };
  };
}
```

#### User Message Events

```typescript
// user.message
{
  type: "user.message";
  data: {
    content: string;
    transformedContent?: string;
    attachments?: Array<
      | { type: "file"; path: string; displayName: string; }
      | { type: "directory"; path: string; displayName: string; }
      | { 
          type: "selection"; 
          filePath: string; 
          displayName: string; 
          text: string;
          selection: {
            start: { line: number; character: number; };
            end: { line: number; character: number; };
          };
        }
    >;
    source?: string;
  };
}

// pending_messages.modified (EPHEMERAL)
{
  type: "pending_messages.modified";
  ephemeral: true;
  data: {};  // Empty!
}
```

#### Assistant Events

```typescript
// assistant.turn_start
{
  type: "assistant.turn_start";
  data: {
    turnId: string;
  };
}

// assistant.intent (EPHEMERAL)
{
  type: "assistant.intent";
  ephemeral: true;
  data: {
    intent: string;
  };
}

// assistant.reasoning (COMPLETE)
{
  type: "assistant.reasoning";
  data: {
    reasoningId: string;
    content: string;
  };
}

// assistant.reasoning_delta (EPHEMERAL - STREAMING)
{
  type: "assistant.reasoning_delta";
  ephemeral: true;
  data: {
    reasoningId: string;
    deltaContent: string;
  };
}

// assistant.message (COMPLETE)
{
  type: "assistant.message";
  data: {
    messageId: string;
    content: string;
    toolRequests?: Array<{
      toolCallId: string;
      name: string;
      arguments?: unknown;
      type?: "function" | "custom";
    }>;
    parentToolCallId?: string;
  };
}

// assistant.message_delta (EPHEMERAL - STREAMING)
{
  type: "assistant.message_delta";
  ephemeral: true;
  data: {
    messageId: string;
    deltaContent: string;
    totalResponseSizeBytes?: number;
    parentToolCallId?: string;
  };
}

// assistant.turn_end
{
  type: "assistant.turn_end";
  data: {
    turnId: string;
  };
}

// assistant.usage (EPHEMERAL)
{
  type: "assistant.usage";
  ephemeral: true;
  data: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    cost?: number;
    duration?: number;
    initiator?: string;
    apiCallId?: string;
    providerCallId?: string;
    quotaSnapshots?: {
      [k: string]: {
        isUnlimitedEntitlement: boolean;
        entitlementRequests: number;
        usedRequests: number;
        usageAllowedWithExhaustedQuota: boolean;
        overage: number;
        overageAllowedWithExhaustedQuota: boolean;
        remainingPercentage: number;
        resetDate?: string;
      };
    };
  };
}
```

#### Tool Events

```typescript
// tool.user_requested
{
  type: "tool.user_requested";
  data: {
    toolCallId: string;
    toolName: string;
    arguments?: unknown;
  };
}

// tool.execution_start
{
  type: "tool.execution_start";
  data: {
    toolCallId: string;
    toolName: string;
    arguments?: unknown;
    mcpServerName?: string;
    mcpToolName?: string;
    parentToolCallId?: string;
  };
}

// tool.execution_partial_result (EPHEMERAL - STREAMING)
{
  type: "tool.execution_partial_result";
  ephemeral: true;
  data: {
    toolCallId: string;
    partialOutput: string;
  };
}

// tool.execution_progress (EPHEMERAL)
{
  type: "tool.execution_progress";
  ephemeral: true;
  data: {
    toolCallId: string;
    progressMessage: string;
  };
}

// tool.execution_complete
{
  type: "tool.execution_complete";
  data: {
    toolCallId: string;
    success: boolean;
    isUserRequested?: boolean;
    result?: {
      content: string;
      detailedContent?: string;
    };
    error?: {
      message: string;
      code?: string;
    };
    toolTelemetry?: {
      [k: string]: unknown;
    };
    parentToolCallId?: string;
  };
}
```

#### Subagent Events

```typescript
// subagent.started
{
  type: "subagent.started";
  data: {
    toolCallId: string;
    agentName: string;
    agentDisplayName: string;
    agentDescription: string;
  };
}

// subagent.completed
{
  type: "subagent.completed";
  data: {
    toolCallId: string;
    agentName: string;
  };
}

// subagent.failed
{
  type: "subagent.failed";
  data: {
    toolCallId: string;
    agentName: string;
    error: string;
  };
}

// subagent.selected
{
  type: "subagent.selected";
  data: {
    agentName: string;
    agentDisplayName: string;
    tools: string[] | null;
  };
}
```

#### Hook Events

```typescript
// hook.start
{
  type: "hook.start";
  data: {
    hookInvocationId: string;
    hookType: string;
    input?: unknown;
  };
}

// hook.end
{
  type: "hook.end";
  data: {
    hookInvocationId: string;
    hookType: string;
    output?: unknown;
    success: boolean;
    error?: {
      message: string;
      stack?: string;
    };
  };
}
```

#### System Message Event

```typescript
// system.message
{
  type: "system.message";
  data: {
    content: string;
    role: "system" | "developer";
    name?: string;
    metadata?: {
      promptVersion?: string;
      variables?: {
        [k: string]: unknown;
      };
    };
  };
}
```

#### Abort Event

```typescript
// abort
{
  type: "abort";
  data: {
    reason: string;
  };
}
```

### Event Type Utilities

```typescript
// All possible event type strings
type SessionEventType = SessionEvent["type"];
// = "session.start" | "session.resume" | "session.error" | "session.idle" | ...

// Extract event payload for specific type
type SessionEventPayload<T extends SessionEventType> = Extract<SessionEvent, { type: T }>;

// Typed event handler for specific type
type TypedSessionEventHandler<T extends SessionEventType> = (event: SessionEventPayload<T>) => void;

// Generic event handler (all events)
type SessionEventHandler = (event: SessionEvent) => void;
```

### Event Subscription

```typescript
class CopilotSession {
  // Subscribe to specific event type
  on<K extends SessionEventType>(
    eventType: K, 
    handler: TypedSessionEventHandler<K>
  ): () => void;
  
  // Subscribe to ALL events
  on(handler: SessionEventHandler): () => void;
}
```

### AssistantMessageEvent (Exported Type)

```typescript
export type AssistantMessageEvent = Extract<SessionEvent, { type: "assistant.message" }>;
```

---

## 3. Tool System

### Tool Definition

```typescript
interface Tool<TArgs = unknown> {
  name: string;
  description?: string;
  parameters?: ZodSchema<TArgs> | Record<string, unknown>;  // Zod or JSON Schema
  handler: ToolHandler<TArgs>;
}
```

### Tool Handler

```typescript
type ToolHandler<TArgs = unknown> = (
  args: TArgs, 
  invocation: ToolInvocation
) => Promise<unknown> | unknown;

interface ToolInvocation {
  sessionId: string;
  toolCallId: string;
  toolName: string;
  arguments: unknown;
}
```

### Tool Result Types

```typescript
type ToolResultType = "success" | "failure" | "rejected" | "denied";

type ToolBinaryResult = {
  data: string;
  mimeType: string;
  type: string;
  description?: string;
};

type ToolResultObject = {
  textResultForLlm: string;
  binaryResultsForLlm?: ToolBinaryResult[];
  resultType: ToolResultType;
  error?: string;
  sessionLog?: string;
  toolTelemetry?: Record<string, unknown>;
};

type ToolResult = string | ToolResultObject;
```

### Zod Schema Interface

```typescript
interface ZodSchema<T = unknown> {
  _output: T;
  toJSONSchema(): Record<string, unknown>;
}
```

### defineTool Helper

```typescript
function defineTool<T = unknown>(
  name: string, 
  config: {
    description?: string;
    parameters?: ZodSchema<T> | Record<string, unknown>;
    handler: ToolHandler<T>;
  }
): Tool<T>;
```

---

## 4. Message Types

### MessageOptions (Sending Messages)

```typescript
interface MessageOptions {
  /** The prompt/message to send */
  prompt: string;
  
  /** File or directory attachments */
  attachments?: Array<{
    type: "file" | "directory";
    path: string;
    displayName?: string;
  }>;
  
  /** Message delivery mode */
  mode?: "enqueue" | "immediate";
}
```

### Attachment Types (in Events)

```typescript
type Attachment = 
  | { type: "file"; path: string; displayName: string; }
  | { type: "directory"; path: string; displayName: string; }
  | { 
      type: "selection"; 
      filePath: string; 
      displayName: string; 
      text: string;
      selection: {
        start: { line: number; character: number; };
        end: { line: number; character: number; };
      };
    };
```

### System Message Configuration

```typescript
// Append mode (default): SDK foundation + optional custom content
interface SystemMessageAppendConfig {
  mode?: "append";
  content?: string;  // Additional instructions appended
}

// Replace mode: Full control, replaces entire system message
interface SystemMessageReplaceConfig {
  mode: "replace";
  content: string;  // Complete system message
}

type SystemMessageConfig = SystemMessageAppendConfig | SystemMessageReplaceConfig;
```

---

## 5. Reasoning/Thinking

### Reasoning Events

The SDK supports extended thinking/reasoning with streaming:

```typescript
// Complete reasoning (after streaming finishes)
{
  type: "assistant.reasoning";
  data: {
    reasoningId: string;
    content: string;  // Full reasoning content
  };
}

// Streaming reasoning delta
{
  type: "assistant.reasoning_delta";
  ephemeral: true;
  data: {
    reasoningId: string;
    deltaContent: string;  // Incremental content
  };
}
```

---

## 6. Subagent Support

### Custom Agent Configuration

```typescript
interface CustomAgentConfig {
  /** Unique name of the custom agent */
  name: string;
  
  /** Display name for UI */
  displayName?: string;
  
  /** Description of what the agent does */
  description?: string;
  
  /** List of tool names the agent can use. null = all tools */
  tools?: string[] | null;
  
  /** The prompt content for the agent */
  prompt: string;
  
  /** MCP servers specific to this agent */
  mcpServers?: Record<string, MCPServerConfig>;
  
  /** Available for model inference. @default true */
  infer?: boolean;
}
```

### Subagent Events

```typescript
// Started
{
  type: "subagent.started";
  data: {
    toolCallId: string;      // Links to tool execution
    agentName: string;
    agentDisplayName: string;
    agentDescription: string;
  };
}

// Completed
{
  type: "subagent.completed";
  data: {
    toolCallId: string;
    agentName: string;
  };
}

// Failed
{
  type: "subagent.failed";
  data: {
    toolCallId: string;
    agentName: string;
    error: string;
  };
}

// Selected (when model chooses a subagent)
{
  type: "subagent.selected";
  data: {
    agentName: string;
    agentDisplayName: string;
    tools: string[] | null;  // Tools available to this subagent
  };
}
```

---

## 7. Stats/Usage

### assistant.usage Event (Primary Usage Tracking)

```typescript
{
  type: "assistant.usage";
  ephemeral: true;
  data: {
    model?: string;
    
    // Token Counts
    inputTokens?: number;
    outputTokens?: number;
    cacheReadTokens?: number;
    cacheWriteTokens?: number;
    
    // Cost and Timing
    cost?: number;           // Cost in dollars (?)
    duration?: number;       // Duration in milliseconds (?)
    
    // Tracing
    initiator?: string;
    apiCallId?: string;
    providerCallId?: string;
    
    // Quota Information
    quotaSnapshots?: {
      [quotaName: string]: {
        isUnlimitedEntitlement: boolean;
        entitlementRequests: number;
        usedRequests: number;
        usageAllowedWithExhaustedQuota: boolean;
        overage: number;
        overageAllowedWithExhaustedQuota: boolean;
        remainingPercentage: number;
        resetDate?: string;
      };
    };
  };
}
```

### session.usage_info Event (Context Usage)

```typescript
{
  type: "session.usage_info";
  ephemeral: true;
  data: {
    tokenLimit: number;      // Max tokens in context
    currentTokens: number;   // Current tokens used
    messagesLength: number;  // Number of messages
  };
}
```

### session.truncation Event (Context Truncation Stats)

```typescript
{
  type: "session.truncation";
  data: {
    tokenLimit: number;
    preTruncationTokensInMessages: number;
    preTruncationMessagesLength: number;
    postTruncationTokensInMessages: number;
    postTruncationMessagesLength: number;
    tokensRemovedDuringTruncation: number;
    messagesRemovedDuringTruncation: number;
    performedBy: string;
  };
}
```

### session.compaction_complete Event (Compaction Stats)

```typescript
{
  type: "session.compaction_complete";
  data: {
    success: boolean;
    error?: string;
    preCompactionTokens?: number;
    postCompactionTokens?: number;
    preCompactionMessagesLength?: number;
    messagesRemoved?: number;
    tokensRemoved?: number;
    summaryContent?: string;
    compactionTokensUsed?: {
      input: number;
      output: number;
      cachedInput: number;
    };
  };
}
```

---

## 8. Enums and Constants

### Log Level

```typescript
type LogLevel = "none" | "error" | "warning" | "info" | "debug" | "all";
```

### Connection State

```typescript
type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
```

### Tool Result Type

```typescript
type ToolResultType = "success" | "failure" | "rejected" | "denied";
```

### Permission Request Kind

```typescript
type PermissionKind = "shell" | "write" | "mcp" | "read" | "url";
```

### Permission Request Result Kind

```typescript
type PermissionResultKind = 
  | "approved" 
  | "denied-by-rules" 
  | "denied-no-approval-rule-and-could-not-request-from-user" 
  | "denied-interactively-by-user";
```

### Session Handoff Source Type

```typescript
type HandoffSourceType = "remote" | "local";
```

### System Message Role

```typescript
type SystemMessageRole = "system" | "developer";
```

### Tool Request Type

```typescript
type ToolRequestType = "function" | "custom";
```

### MCP Server Type

```typescript
type MCPServerType = "local" | "stdio" | "http" | "sse";
```

### Provider Type

```typescript
type ProviderType = "openai" | "azure" | "anthropic";
```

### Wire API Format

```typescript
type WireApi = "completions" | "responses";
```

### Message Mode

```typescript
type MessageMode = "enqueue" | "immediate";
```

### Auth Type

```typescript
type AuthType = "user" | "env" | "gh-cli" | "hmac" | "api-key" | "token";
```

### Model Policy State

```typescript
type PolicyState = "enabled" | "disabled" | "unconfigured";
```

### Hook Error Context

```typescript
type ErrorContext = "model_call" | "tool_execution" | "system" | "user_input";
```

### Hook Error Handling

```typescript
type ErrorHandling = "retry" | "skip" | "abort";
```

### Session Start Source

```typescript
type SessionStartSource = "startup" | "resume" | "new";
```

### Session End Reason

```typescript
type SessionEndReason = "complete" | "error" | "abort" | "timeout" | "user_exit";
```

### Protocol Version

```typescript
const SDK_PROTOCOL_VERSION = 2;
```

---

## 9. Response Types

### GetStatusResponse

```typescript
interface GetStatusResponse {
  version: string;        // Package version (e.g., "1.0.0")
  protocolVersion: number; // Protocol version for SDK compatibility
}
```

### GetAuthStatusResponse

```typescript
interface GetAuthStatusResponse {
  isAuthenticated: boolean;
  authType?: "user" | "env" | "gh-cli" | "hmac" | "api-key" | "token";
  host?: string;           // GitHub host URL
  login?: string;          // User login name
  statusMessage?: string;  // Human-readable status
}
```

### ModelInfo

```typescript
interface ModelInfo {
  id: string;       // Model identifier (e.g., "claude-sonnet-4.5")
  name: string;     // Display name
  capabilities: ModelCapabilities;
  policy?: ModelPolicy;
  billing?: ModelBilling;
}

interface ModelCapabilities {
  supports: {
    vision: boolean;
  };
  limits: {
    max_prompt_tokens?: number;
    max_context_window_tokens: number;
    vision?: {
      supported_media_types: string[];
      max_prompt_images: number;
      max_prompt_image_size: number;
    };
  };
}

interface ModelPolicy {
  state: "enabled" | "disabled" | "unconfigured";
  terms: string;
}

interface ModelBilling {
  multiplier: number;
}
```

### Ping Response

```typescript
interface PingResponse {
  message: string;
  timestamp: number;
  protocolVersion?: number;
}
```

---

## 10. Hooks System

### SessionHooks Configuration

```typescript
interface SessionHooks {
  onPreToolUse?: PreToolUseHandler;
  onPostToolUse?: PostToolUseHandler;
  onUserPromptSubmitted?: UserPromptSubmittedHandler;
  onSessionStart?: SessionStartHandler;
  onSessionEnd?: SessionEndHandler;
  onErrorOccurred?: ErrorOccurredHandler;
}
```

### Base Hook Input

```typescript
interface BaseHookInput {
  timestamp: number;
  cwd: string;
}
```

### Pre-Tool-Use Hook

```typescript
interface PreToolUseHookInput extends BaseHookInput {
  toolName: string;
  toolArgs: unknown;
}

interface PreToolUseHookOutput {
  permissionDecision?: "allow" | "deny" | "ask";
  permissionDecisionReason?: string;
  modifiedArgs?: unknown;
  additionalContext?: string;
  suppressOutput?: boolean;
}

type PreToolUseHandler = (
  input: PreToolUseHookInput, 
  invocation: { sessionId: string }
) => Promise<PreToolUseHookOutput | void> | PreToolUseHookOutput | void;
```

### Post-Tool-Use Hook

```typescript
interface PostToolUseHookInput extends BaseHookInput {
  toolName: string;
  toolArgs: unknown;
  toolResult: ToolResultObject;
}

interface PostToolUseHookOutput {
  modifiedResult?: ToolResultObject;
  additionalContext?: string;
  suppressOutput?: boolean;
}

type PostToolUseHandler = (
  input: PostToolUseHookInput, 
  invocation: { sessionId: string }
) => Promise<PostToolUseHookOutput | void> | PostToolUseHookOutput | void;
```

### User-Prompt-Submitted Hook

```typescript
interface UserPromptSubmittedHookInput extends BaseHookInput {
  prompt: string;
}

interface UserPromptSubmittedHookOutput {
  modifiedPrompt?: string;
  additionalContext?: string;
  suppressOutput?: boolean;
}

type UserPromptSubmittedHandler = (
  input: UserPromptSubmittedHookInput, 
  invocation: { sessionId: string }
) => Promise<UserPromptSubmittedHookOutput | void> | UserPromptSubmittedHookOutput | void;
```

### Session-Start Hook

```typescript
interface SessionStartHookInput extends BaseHookInput {
  source: "startup" | "resume" | "new";
  initialPrompt?: string;
}

interface SessionStartHookOutput {
  additionalContext?: string;
  modifiedConfig?: Record<string, unknown>;
}

type SessionStartHandler = (
  input: SessionStartHookInput, 
  invocation: { sessionId: string }
) => Promise<SessionStartHookOutput | void> | SessionStartHookOutput | void;
```

### Session-End Hook

```typescript
interface SessionEndHookInput extends BaseHookInput {
  reason: "complete" | "error" | "abort" | "timeout" | "user_exit";
  finalMessage?: string;
  error?: string;
}

interface SessionEndHookOutput {
  suppressOutput?: boolean;
  cleanupActions?: string[];
  sessionSummary?: string;
}

type SessionEndHandler = (
  input: SessionEndHookInput, 
  invocation: { sessionId: string }
) => Promise<SessionEndHookOutput | void> | SessionEndHookOutput | void;
```

### Error-Occurred Hook

```typescript
interface ErrorOccurredHookInput extends BaseHookInput {
  error: string;
  errorContext: "model_call" | "tool_execution" | "system" | "user_input";
  recoverable: boolean;
}

interface ErrorOccurredHookOutput {
  suppressOutput?: boolean;
  errorHandling?: "retry" | "skip" | "abort";
  retryCount?: number;
  userNotification?: string;
}

type ErrorOccurredHandler = (
  input: ErrorOccurredHookInput, 
  invocation: { sessionId: string }
) => Promise<ErrorOccurredHookOutput | void> | ErrorOccurredHookOutput | void;
```

---

## 11. MCP Server Configuration

### Base Configuration

```typescript
interface MCPServerConfigBase {
  /** Tools to include: [] = none, "*" = all */
  tools: string[];
  
  /** Server type. Defaults to "local" */
  type?: string;
  
  /** Timeout in milliseconds for tool calls */
  timeout?: number;
}
```

### Local/Stdio Server

```typescript
interface MCPLocalServerConfig extends MCPServerConfigBase {
  type?: "local" | "stdio";
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
}
```

### Remote Server (HTTP/SSE)

```typescript
interface MCPRemoteServerConfig extends MCPServerConfigBase {
  type: "http" | "sse";
  url: string;
  headers?: Record<string, string>;
}
```

### Union Type

```typescript
type MCPServerConfig = MCPLocalServerConfig | MCPRemoteServerConfig;
```

---

## 12. Provider Configuration (BYOK)

```typescript
interface ProviderConfig {
  /** Provider type. Defaults to "openai" */
  type?: "openai" | "azure" | "anthropic";
  
  /** API format (openai/azure only). Defaults to "completions" */
  wireApi?: "completions" | "responses";
  
  /** API endpoint URL */
  baseUrl: string;
  
  /** API key (optional for local providers like Ollama) */
  apiKey?: string;
  
  /** Bearer token (takes precedence over apiKey) */
  bearerToken?: string;
  
  /** Azure-specific options */
  azure?: {
    apiVersion?: string;  // Defaults to "2024-10-21"
  };
}
```

---

## 13. Permission System

### Permission Request

```typescript
interface PermissionRequest {
  kind: "shell" | "write" | "mcp" | "read" | "url";
  toolCallId?: string;
  [key: string]: unknown;  // Additional context
}
```

### Permission Result

```typescript
interface PermissionRequestResult {
  kind: 
    | "approved" 
    | "denied-by-rules" 
    | "denied-no-approval-rule-and-could-not-request-from-user" 
    | "denied-interactively-by-user";
  rules?: unknown[];
}

type PermissionHandler = (
  request: PermissionRequest, 
  invocation: { sessionId: string }
) => Promise<PermissionRequestResult> | PermissionRequestResult;
```

---

## 14. User Input System (ask_user tool)

### User Input Request

```typescript
interface UserInputRequest {
  question: string;
  choices?: string[];      // Optional multiple choice
  allowFreeform?: boolean; // Allow freeform in addition to choices. @default true
}
```

### User Input Response

```typescript
interface UserInputResponse {
  answer: string;
  wasFreeform: boolean;
}

type UserInputHandler = (
  request: UserInputRequest, 
  invocation: { sessionId: string }
) => Promise<UserInputResponse> | UserInputResponse;
```

---

## Summary: Key Exports

From `@github/copilot-sdk`:

```typescript
// Classes
export { CopilotClient } from "./client.js";
export { CopilotSession, type AssistantMessageEvent } from "./session.js";

// Helper Functions
export { defineTool } from "./types.js";

// Types (all from types.js)
export type {
  // Client/Connection
  ConnectionState,
  CopilotClientOptions,
  
  // Session
  SessionConfig,
  ResumeSessionConfig,
  InfiniteSessionConfig,
  SessionMetadata,
  
  // Events
  SessionEvent,
  SessionEventType,
  SessionEventPayload,
  SessionEventHandler,
  TypedSessionEventHandler,
  
  // Messages
  MessageOptions,
  SystemMessageConfig,
  SystemMessageAppendConfig,
  SystemMessageReplaceConfig,
  
  // Tools
  Tool,
  ToolHandler,
  ToolInvocation,
  ToolResultObject,
  ZodSchema,
  
  // Permissions
  PermissionHandler,
  PermissionRequest,
  PermissionRequestResult,
  
  // MCP
  MCPServerConfig,
  MCPLocalServerConfig,
  MCPRemoteServerConfig,
  
  // Custom Agents
  CustomAgentConfig,
  
  // Models
  ModelInfo,
  ModelCapabilities,
  ModelPolicy,
  ModelBilling,
  
  // Status
  GetStatusResponse,
  GetAuthStatusResponse,
};
```
