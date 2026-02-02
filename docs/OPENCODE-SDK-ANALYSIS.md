# @opencode-ai/sdk Comprehensive Analysis

**Version**: 1.1.48  
**Package**: `@opencode-ai/sdk`

This document provides an exhaustive analysis of all types, interfaces, events, enums, and APIs in the OpenCode SDK.

---

## Table of Contents

1. [Client Architecture](#1-client-architecture)
2. [Event System](#2-event-system)
3. [Message Part Types](#3-message-part-types)
4. [Tool System](#4-tool-system)
5. [Stats/Usage Tracking](#5-statsusage-tracking)
6. [File Events](#6-file-events)
7. [Permission System](#7-permission-system)
8. [Subagent Support](#8-subagent-support)
9. [Session Management](#9-session-management)
10. [MCP Integration](#10-mcp-integration)
11. [Error Types](#11-error-types)
12. [All Enums and Constants](#12-all-enums-and-constants)

---

## 1. Client Architecture

### Creating the Client

```typescript
import { createOpencodeClient, createOpencode } from "@opencode-ai/sdk";

// Method 1: Client only (requires existing server)
const client = createOpencodeClient({
  baseUrl: "http://localhost:3000",
  directory: "/path/to/project"
});

// Method 2: Client + Server (starts a new server)
const { client, server } = await createOpencode({
  hostname: "localhost",
  port: 3000,
  timeout: 5000
});
```

### Client Configuration (`Config`)

```typescript
interface ClientOptions {
  baseUrl: `${string}://${string}` | (string & {});
}

interface Config {
  baseUrl?: string;
  fetch?: (request: Request) => ReturnType<typeof fetch>;
  parseAs?: "arrayBuffer" | "auto" | "blob" | "formData" | "json" | "stream" | "text";
  responseStyle?: "data" | "fields";  // Default: "fields"
  throwOnError?: boolean;              // Default: false
}
```

### Server Options

```typescript
interface ServerOptions {
  hostname?: string;
  port?: number;
  signal?: AbortSignal;
  timeout?: number;
  config?: Config;
}

interface TuiOptions {
  project?: string;
  model?: string;
  session?: string;
  agent?: string;
  signal?: AbortSignal;
  config?: Config;
}
```

### OpencodeClient Class Structure

```typescript
class OpencodeClient {
  global: Global;      // Global events
  project: Project;    // Project management
  pty: Pty;           // Pseudo-terminal sessions
  config: Config;     // Configuration
  tool: Tool;         // Tool management
  instance: Instance; // Instance lifecycle
  path: Path;         // Path utilities
  vcs: Vcs;           // Version control
  session: Session;   // Session management
  command: Command;   // Command execution
  provider: Provider; // Provider management
  find: Find;         // Search functionality
  file: File;         // File operations
  app: App;           // Application utilities
  mcp: Mcp;           // MCP server management
  lsp: Lsp;           // LSP server status
  formatter: Formatter;
  tui: Tui;           // TUI control
  auth: Auth;         // Authentication
  event: Event;       // Event subscription
}
```

### SSE Subscription Model

```typescript
// Subscribe to events
const { stream } = await client.event.subscribe();

// Iterate over events
for await (const event of stream) {
  switch (event.type) {
    case "session.created":
      console.log("Session created:", event.properties.info);
      break;
    case "message.updated":
      console.log("Message updated:", event.properties.info);
      break;
    // ... handle other events
  }
}

// SSE Options
interface ServerSentEventsOptions<TData> {
  onSseError?: (error: unknown) => void;
  onSseEvent?: (event: StreamEvent<TData>) => void;
  sseDefaultRetryDelay?: number;    // Default: 3000
  sseMaxRetryAttempts?: number;
  sseMaxRetryDelay?: number;        // Default: 30000
  sseSleepFn?: (ms: number) => Promise<void>;
  url: string;
}

interface StreamEvent<TData> {
  data: TData;
  event?: string;
  id?: string;
  retry?: number;
}
```

---

## 2. Event System

### Complete Event Union Type

```typescript
type Event =
  // Server/Installation Events
  | EventServerInstanceDisposed
  | EventServerConnected
  | EventInstallationUpdated
  | EventInstallationUpdateAvailable
  
  // LSP Events
  | EventLspClientDiagnostics
  | EventLspUpdated
  
  // Message Events
  | EventMessageUpdated
  | EventMessageRemoved
  | EventMessagePartUpdated
  | EventMessagePartRemoved
  
  // Permission Events
  | EventPermissionUpdated      // v1
  | EventPermissionAsked        // v2
  | EventPermissionReplied
  
  // Session Events
  | EventSessionStatus
  | EventSessionIdle
  | EventSessionCompacted
  | EventSessionCreated
  | EventSessionUpdated
  | EventSessionDeleted
  | EventSessionDiff
  | EventSessionError
  
  // File Events
  | EventFileEdited
  | EventFileWatcherUpdated
  
  // VCS Events
  | EventVcsBranchUpdated
  
  // TUI Events
  | EventTuiPromptAppend
  | EventTuiCommandExecute
  | EventTuiToastShow
  | EventTuiSessionSelect      // v2 only
  
  // PTY Events
  | EventPtyCreated
  | EventPtyUpdated
  | EventPtyExited
  | EventPtyDeleted
  
  // Todo Events
  | EventTodoUpdated
  
  // Command Events
  | EventCommandExecuted
  
  // Question Events (v2 only)
  | EventQuestionAsked
  | EventQuestionReplied
  | EventQuestionRejected
  
  // MCP Events (v2 only)
  | EventMcpToolsChanged
  | EventMcpBrowserOpenFailed
  
  // Worktree Events (v2 only)
  | EventWorktreeReady
  | EventWorktreeFailed
  
  // Project Events (v2 only)
  | EventProjectUpdated
  | EventGlobalDisposed;
```

### Event Type Strings (Exact Strings)

```typescript
// Server/System Events
"server.instance.disposed"
"server.connected"
"installation.updated"
"installation.update-available"
"global.disposed"           // v2

// LSP Events
"lsp.client.diagnostics"
"lsp.updated"

// Message Events
"message.updated"
"message.removed"
"message.part.updated"
"message.part.removed"

// Session Events
"session.created"
"session.updated"
"session.deleted"
"session.idle"
"session.status"
"session.compacted"
"session.diff"
"session.error"

// File Events
"file.edited"
"file.watcher.updated"

// Permission Events
"permission.updated"        // v1
"permission.asked"          // v2
"permission.replied"

// VCS Events
"vcs.branch.updated"

// TUI Events
"tui.prompt.append"
"tui.command.execute"
"tui.toast.show"
"tui.session.select"        // v2

// PTY Events
"pty.created"
"pty.updated"
"pty.exited"
"pty.deleted"

// Todo Events
"todo.updated"

// Command Events
"command.executed"

// Question Events (v2)
"question.asked"
"question.replied"
"question.rejected"

// MCP Events (v2)
"mcp.tools.changed"
"mcp.browser.open.failed"

// Worktree Events (v2)
"worktree.ready"
"worktree.failed"

// Project Events (v2)
"project.updated"
```

### Event Payload Interfaces

```typescript
// Global Event Wrapper
interface GlobalEvent {
  directory: string;
  payload: Event;
}

// Session Events
interface EventSessionCreated {
  type: "session.created";
  properties: {
    info: Session;
  };
}

interface EventSessionUpdated {
  type: "session.updated";
  properties: {
    info: Session;
  };
}

interface EventSessionDeleted {
  type: "session.deleted";
  properties: {
    info: Session;
  };
}

interface EventSessionIdle {
  type: "session.idle";
  properties: {
    sessionID: string;
  };
}

interface EventSessionStatus {
  type: "session.status";
  properties: {
    sessionID: string;
    status: SessionStatus;
  };
}

interface EventSessionError {
  type: "session.error";
  properties: {
    sessionID?: string;
    error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | ApiError;
  };
}

interface EventSessionCompacted {
  type: "session.compacted";
  properties: {
    sessionID: string;
  };
}

interface EventSessionDiff {
  type: "session.diff";
  properties: {
    sessionID: string;
    diff: Array<FileDiff>;
  };
}

// Message Events
interface EventMessageUpdated {
  type: "message.updated";
  properties: {
    info: Message;
  };
}

interface EventMessageRemoved {
  type: "message.removed";
  properties: {
    sessionID: string;
    messageID: string;
  };
}

interface EventMessagePartUpdated {
  type: "message.part.updated";
  properties: {
    part: Part;
    delta?: string;  // Incremental text for streaming
  };
}

interface EventMessagePartRemoved {
  type: "message.part.removed";
  properties: {
    sessionID: string;
    messageID: string;
    partID: string;
  };
}

// File Events
interface EventFileEdited {
  type: "file.edited";
  properties: {
    file: string;
  };
}

interface EventFileWatcherUpdated {
  type: "file.watcher.updated";
  properties: {
    file: string;
    event: "add" | "change" | "unlink";
  };
}

// Permission Events (v1)
interface EventPermissionUpdated {
  type: "permission.updated";
  properties: Permission;
}

// Permission Events (v2)
interface EventPermissionAsked {
  type: "permission.asked";
  properties: PermissionRequest;
}

interface EventPermissionReplied {
  type: "permission.replied";
  properties: {
    sessionID: string;
    permissionID: string;  // v1
    requestID: string;     // v2
    response: string;      // v1: "once" | "always" | "reject"
    reply: "once" | "always" | "reject";  // v2
  };
}

// Question Events (v2)
interface EventQuestionAsked {
  type: "question.asked";
  properties: QuestionRequest;
}

interface EventQuestionReplied {
  type: "question.replied";
  properties: {
    sessionID: string;
    requestID: string;
    answers: Array<QuestionAnswer>;
  };
}

interface EventQuestionRejected {
  type: "question.rejected";
  properties: {
    sessionID: string;
    requestID: string;
  };
}

// PTY Events
interface EventPtyCreated {
  type: "pty.created";
  properties: { info: Pty };
}

interface EventPtyUpdated {
  type: "pty.updated";
  properties: { info: Pty };
}

interface EventPtyExited {
  type: "pty.exited";
  properties: {
    id: string;
    exitCode: number;
  };
}

interface EventPtyDeleted {
  type: "pty.deleted";
  properties: { id: string };
}

// Todo Events
interface EventTodoUpdated {
  type: "todo.updated";
  properties: {
    sessionID: string;
    todos: Array<Todo>;
  };
}

// TUI Events
interface EventTuiPromptAppend {
  type: "tui.prompt.append";
  properties: { text: string };
}

interface EventTuiCommandExecute {
  type: "tui.command.execute";
  properties: {
    command: "session.list" | "session.new" | "session.share" | 
             "session.interrupt" | "session.compact" | "session.page.up" | 
             "session.page.down" | "session.half.page.up" | "session.half.page.down" | 
             "session.first" | "session.last" | "prompt.clear" | 
             "prompt.submit" | "agent.cycle" | string;
  };
}

interface EventTuiToastShow {
  type: "tui.toast.show";
  properties: {
    title?: string;
    message: string;
    variant: "info" | "success" | "warning" | "error";
    duration?: number;  // milliseconds
  };
}
```

---

## 3. Message Part Types

### Part Union Type

```typescript
type Part =
  | TextPart
  | SubtaskPart
  | ReasoningPart
  | FilePart
  | ToolPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart
  | AgentPart
  | RetryPart
  | CompactionPart;
```

### Part Type Strings

```typescript
"text"        // TextPart
"subtask"     // SubtaskPart
"reasoning"   // ReasoningPart
"file"        // FilePart
"tool"        // ToolPart
"step-start"  // StepStartPart
"step-finish" // StepFinishPart
"snapshot"    // SnapshotPart
"patch"       // PatchPart
"agent"       // AgentPart
"retry"       // RetryPart
"compaction"  // CompactionPart
```

### Base Part Fields

All parts share these common fields:

```typescript
interface BasePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: string;
}
```

### TextPart

```typescript
interface TextPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "text";
  text: string;
  synthetic?: boolean;   // Generated/artificial text
  ignored?: boolean;     // Should be ignored in processing
  time?: {
    start: number;
    end?: number;
  };
  metadata?: Record<string, unknown>;
}
```

### ReasoningPart

```typescript
interface ReasoningPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "reasoning";
  text: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
    end?: number;
  };
}
```

### FilePart

```typescript
interface FilePart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
}

type FilePartSource = FileSource | SymbolSource | ResourceSource;

interface FileSource {
  text: FilePartSourceText;
  type: "file";
  path: string;
}

interface SymbolSource {
  text: FilePartSourceText;
  type: "symbol";
  path: string;
  range: Range;
  name: string;
  kind: number;
}

interface ResourceSource {  // v2 only
  text: FilePartSourceText;
  type: "resource";
  clientName: string;
  uri: string;
}

interface FilePartSourceText {
  value: string;
  start: number;
  end: number;
}

interface Range {
  start: { line: number; character: number };
  end: { line: number; character: number };
}
```

### ToolPart

```typescript
interface ToolPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "tool";
  callID: string;
  tool: string;          // Tool name/identifier
  state: ToolState;
  metadata?: Record<string, unknown>;
}
```

### StepStartPart

```typescript
interface StepStartPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-start";
  snapshot?: string;     // Optional snapshot reference
}
```

### StepFinishPart

```typescript
interface StepFinishPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "step-finish";
  reason: string;        // Why the step finished
  snapshot?: string;
  cost: number;          // Cost of this step
  tokens: {
    input: number;
    output: number;
    reasoning: number;
    cache: {
      read: number;
      write: number;
    };
  };
}
```

### SnapshotPart

```typescript
interface SnapshotPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "snapshot";
  snapshot: string;      // Snapshot identifier/reference
}
```

### PatchPart

```typescript
interface PatchPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "patch";
  hash: string;
  files: Array<string>;  // Files affected by the patch
}
```

### AgentPart

```typescript
interface AgentPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "agent";
  name: string;          // Agent name being invoked
  source?: {
    value: string;
    start: number;
    end: number;
  };
}
```

### SubtaskPart

```typescript
interface SubtaskPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "subtask";
  prompt: string;        // The subtask prompt
  description: string;   // Human-readable description
  agent: string;         // Agent to execute the subtask
  model?: {              // v2 only
    providerID: string;
    modelID: string;
  };
  command?: string;      // v2 only
}
```

### RetryPart

```typescript
interface RetryPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "retry";
  attempt: number;
  error: ApiError;
  time: {
    created: number;
  };
}
```

### CompactionPart

```typescript
interface CompactionPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "compaction";
  auto: boolean;         // Was this automatic compaction?
}
```

### Part Input Types (For Creating Messages)

```typescript
interface TextPartInput {
  id?: string;
  type: "text";
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

interface FilePartInput {
  id?: string;
  type: "file";
  mime: string;
  filename?: string;
  url: string;
  source?: FilePartSource;
}

interface AgentPartInput {
  id?: string;
  type: "agent";
  name: string;
  source?: { value: string; start: number; end: number };
}

interface SubtaskPartInput {
  id?: string;
  type: "subtask";
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
}
```

---

## 4. Tool System

### Tool State Machine

```typescript
type ToolState =
  | ToolStatePending
  | ToolStateRunning
  | ToolStateCompleted
  | ToolStateError;
```

### Tool State Definitions

```typescript
interface ToolStatePending {
  status: "pending";
  input: Record<string, unknown>;
  raw: string;
}

interface ToolStateRunning {
  status: "running";
  input: Record<string, unknown>;
  title?: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
  };
}

interface ToolStateCompleted {
  status: "completed";
  input: Record<string, unknown>;
  output: string;
  title: string;
  metadata: Record<string, unknown>;
  time: {
    start: number;
    end: number;
    compacted?: number;
  };
  attachments?: Array<FilePart>;
}

interface ToolStateError {
  status: "error";
  input: Record<string, unknown>;
  error: string;
  metadata?: Record<string, unknown>;
  time: {
    start: number;
    end: number;
  };
}
```

### Tool State Transitions

```
pending → running → completed
pending → running → error
```

### Tool List Item

```typescript
interface ToolListItem {
  id: string;
  description: string;
  parameters: unknown;  // JSON Schema
}

type ToolList = Array<ToolListItem>;
type ToolIds = Array<string>;
```

### Tool API

```typescript
// Get all tool IDs
const toolIds = await client.tool.ids();

// Get tools with schemas for a specific provider/model
const tools = await client.tool.list({
  query: {
    provider: "anthropic",
    model: "claude-3-opus-20240229"
  }
});
```

---

## 5. Stats/Usage Tracking

### Token Structure

```typescript
interface TokenUsage {
  input: number;       // Input tokens consumed
  output: number;      // Output tokens generated
  reasoning: number;   // Reasoning tokens (for models that support it)
  cache: {
    read: number;      // Cache read tokens
    write: number;     // Cache write tokens
  };
}
```

### Message-Level Stats (AssistantMessage)

```typescript
interface AssistantMessage {
  // ... other fields
  cost: number;           // Total cost for this message
  tokens: TokenUsage;
  finish?: string;        // Finish reason
}
```

### Step-Level Stats (StepFinishPart)

```typescript
interface StepFinishPart {
  // ... other fields
  cost: number;           // Cost for this step
  tokens: TokenUsage;
  reason: string;         // Why the step finished
}
```

### Model Cost Configuration

```typescript
interface ModelCost {
  input: number;          // Cost per input token
  output: number;         // Cost per output token
  cache_read?: number;    // Cost per cache read token
  cache_write?: number;   // Cost per cache write token
  context_over_200k?: {   // Pricing for large contexts
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
}

interface Model {
  // ... other fields
  cost: {
    input: number;
    output: number;
    cache: {
      read: number;
      write: number;
    };
    experimentalOver200K?: {
      input: number;
      output: number;
      cache: { read: number; write: number };
    };
  };
  limit: {
    context: number;
    input?: number;   // v2 only
    output: number;
  };
}
```

---

## 6. File Events

### File Edited Event

```typescript
interface EventFileEdited {
  type: "file.edited";
  properties: {
    file: string;  // File path
  };
}
```

### File Watcher Event

```typescript
interface EventFileWatcherUpdated {
  type: "file.watcher.updated";
  properties: {
    file: string;
    event: "add" | "change" | "unlink";  // Change kinds
  };
}
```

### File Change Kinds

```typescript
"add"     // File created
"change"  // File modified
"unlink"  // File deleted
```

### File Diff Structure

```typescript
interface FileDiff {
  file: string;
  before: string;
  after: string;
  additions: number;
  deletions: number;
}
```

### File Status

```typescript
interface File {
  path: string;
  added: number;
  removed: number;
  status: "added" | "deleted" | "modified";
}
```

### File Content

```typescript
interface FileContent {
  type: "text";
  content: string;
  diff?: string;
  patch?: {
    oldFileName: string;
    newFileName: string;
    oldHeader?: string;
    newHeader?: string;
    hunks: Array<{
      oldStart: number;
      oldLines: number;
      newStart: number;
      newLines: number;
      lines: Array<string>;
    }>;
    index?: string;
  };
  encoding?: "base64";
  mimeType?: string;
}
```

---

## 7. Permission System

### Permission (v1)

```typescript
interface Permission {
  id: string;
  type: string;
  pattern?: string | Array<string>;
  sessionID: string;
  messageID: string;
  callID?: string;
  title: string;
  metadata: Record<string, unknown>;
  time: {
    created: number;
  };
}
```

### Permission Request (v2)

```typescript
interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: Array<string>;
  metadata: Record<string, unknown>;
  always: Array<string>;
  tool?: {
    messageID: string;
    callID: string;
  };
}
```

### Permission Response

```typescript
// v1
interface PostSessionIdPermissionsPermissionIdData {
  body?: {
    response: "once" | "always" | "reject";
  };
  path: {
    id: string;           // Session ID
    permissionID: string;
  };
}

// v2
interface EventPermissionReplied {
  type: "permission.replied";
  properties: {
    sessionID: string;
    requestID: string;
    reply: "once" | "always" | "reject";
  };
}
```

### Permission Actions

```typescript
type PermissionAction = "allow" | "deny" | "ask";
```

### Permission Rule (v2)

```typescript
interface PermissionRule {
  permission: string;
  pattern: string;
  action: PermissionAction;
}

type PermissionRuleset = Array<PermissionRule>;
```

### Permission Configuration

```typescript
type PermissionActionConfig = "ask" | "allow" | "deny";
type PermissionObjectConfig = Record<string, PermissionActionConfig>;
type PermissionRuleConfig = PermissionActionConfig | PermissionObjectConfig;

interface PermissionConfig {
  __originalKeys?: Array<string>;
  read?: PermissionRuleConfig;
  edit?: PermissionRuleConfig;
  glob?: PermissionRuleConfig;
  grep?: PermissionRuleConfig;
  list?: PermissionRuleConfig;
  bash?: PermissionRuleConfig;
  task?: PermissionRuleConfig;
  external_directory?: PermissionRuleConfig;
  todowrite?: PermissionActionConfig;
  todoread?: PermissionActionConfig;
  question?: PermissionActionConfig;
  webfetch?: PermissionActionConfig;
  websearch?: PermissionActionConfig;
  codesearch?: PermissionActionConfig;
  lsp?: PermissionRuleConfig;
  doom_loop?: PermissionActionConfig;
  skill?: PermissionRuleConfig;
}
```

---

## 8. Subagent Support

### AgentPart Interface

```typescript
interface AgentPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "agent";
  name: string;              // Agent name being delegated to
  source?: {
    value: string;           // Source text that triggered the delegation
    start: number;
    end: number;
  };
}
```

### SubtaskPart Interface

```typescript
interface SubtaskPart {
  id: string;
  sessionID: string;
  messageID: string;
  type: "subtask";
  prompt: string;            // The subtask prompt/instruction
  description: string;       // Human-readable description
  agent: string;             // Agent to execute subtask
  model?: {                  // v2: Optional model override
    providerID: string;
    modelID: string;
  };
  command?: string;          // v2: Optional command to execute
}
```

### Agent Definition

```typescript
interface Agent {
  name: string;
  description?: string;
  mode: "subagent" | "primary" | "all";
  native?: boolean;          // v2: Built-in agent
  hidden?: boolean;          // v2: Hide from UI
  topP?: number;
  temperature?: number;
  color?: string;            // Hex color code
  permission: PermissionRuleset;  // v2
  model?: {
    modelID: string;
    providerID: string;
  };
  prompt?: string;
  options: Record<string, unknown>;
  steps?: number;            // v2: Max steps
}
```

### Agent Configuration

```typescript
interface AgentConfig {
  model?: string;
  temperature?: number;
  top_p?: number;
  prompt?: string;
  tools?: Record<string, boolean>;     // Deprecated in v2
  disable?: boolean;
  description?: string;
  mode?: "subagent" | "primary" | "all";
  hidden?: boolean;                     // v2: Hide from autocomplete
  options?: Record<string, unknown>;
  color?: string;
  steps?: number;                       // v2
  maxSteps?: number;                    // Deprecated, use steps
  permission?: PermissionConfig;
}
```

### Agent Modes

```typescript
"subagent"  // Can only be invoked by other agents
"primary"   // Can be selected by user as main agent
"all"       // Both subagent and primary
```

### Built-in Agents

```typescript
// Default agent configuration structure
interface AgentDefaults {
  plan?: AgentConfig;
  build?: AgentConfig;
  general?: AgentConfig;
  explore?: AgentConfig;
  title?: AgentConfig;        // v2
  summary?: AgentConfig;      // v2
  compaction?: AgentConfig;   // v2
}
```

---

## 9. Session Management

### Session Interface

```typescript
interface Session {
  id: string;
  slug: string;              // v2: URL-friendly identifier
  projectID: string;
  directory: string;
  parentID?: string;         // For child sessions
  summary?: {
    additions: number;
    deletions: number;
    files: number;
    diffs?: Array<FileDiff>;
  };
  share?: {
    url: string;
  };
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;       // v2
  };
  permission?: PermissionRuleset;  // v2
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  };
}
```

### Session Status

```typescript
type SessionStatus =
  | { type: "idle" }
  | { type: "retry"; attempt: number; message: string; next: number }
  | { type: "busy" };
```

### Message Types

```typescript
type Message = UserMessage | AssistantMessage;

interface UserMessage {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  summary?: {
    title?: string;
    body?: string;
    diffs: Array<FileDiff>;
  };
  agent: string;
  model: { providerID: string; modelID: string };
  system?: string;
  tools?: Record<string, boolean>;
  variant?: string;          // v2
}

interface AssistantMessage {
  id: string;
  sessionID: string;
  role: "assistant";
  time: {
    created: number;
    completed?: number;
  };
  error?: ProviderAuthError | UnknownError | MessageOutputLengthError | MessageAbortedError | ApiError;
  parentID: string;
  modelID: string;
  providerID: string;
  mode: string;
  agent: string;             // v2
  path: { cwd: string; root: string };
  summary?: boolean;
  cost: number;
  tokens: TokenUsage;
  finish?: string;
}
```

### Session API

```typescript
// Create session
const session = await client.session.create({
  body: {
    parentID?: string;
    title?: string;
  }
});

// Get session
const session = await client.session.get({
  path: { id: sessionId }
});

// List sessions
const sessions = await client.session.list();

// Send prompt (synchronous)
const response = await client.session.prompt({
  path: { id: sessionId },
  body: {
    messageID?: string;
    model?: { providerID: string; modelID: string };
    agent?: string;
    noReply?: boolean;
    system?: string;
    tools?: Record<string, boolean>;
    parts: Array<TextPartInput | FilePartInput | AgentPartInput | SubtaskPartInput>;
  }
});

// Send prompt (asynchronous - returns immediately)
await client.session.promptAsync({
  path: { id: sessionId },
  body: { /* same as prompt */ }
});

// Abort session
await client.session.abort({ path: { id: sessionId } });

// Fork session
const forked = await client.session.fork({
  path: { id: sessionId },
  body: { messageID?: string }
});

// Revert to message
await client.session.revert({
  path: { id: sessionId },
  body: { messageID: string; partID?: string }
});

// Get session messages
const messages = await client.session.messages({
  path: { id: sessionId },
  query: { limit?: number }
});
```

---

## 10. MCP Integration

### MCP Configuration

```typescript
interface McpLocalConfig {
  type: "local";
  command: Array<string>;
  environment?: Record<string, string>;
  enabled?: boolean;
  timeout?: number;  // Default: 5000ms
}

interface McpRemoteConfig {
  type: "remote";
  url: string;
  enabled?: boolean;
  headers?: Record<string, string>;
  oauth?: McpOAuthConfig | false;
  timeout?: number;  // Default: 5000ms
}

interface McpOAuthConfig {
  clientId?: string;
  clientSecret?: string;
  scope?: string;
}
```

### MCP Status

```typescript
type McpStatus =
  | McpStatusConnected
  | McpStatusDisabled
  | McpStatusFailed
  | McpStatusNeedsAuth
  | McpStatusNeedsClientRegistration;

interface McpStatusConnected {
  status: "connected";
}

interface McpStatusDisabled {
  status: "disabled";
}

interface McpStatusFailed {
  status: "failed";
  error: string;
}

interface McpStatusNeedsAuth {
  status: "needs_auth";
}

interface McpStatusNeedsClientRegistration {
  status: "needs_client_registration";
  error: string;
}
```

### MCP Events (v2)

```typescript
interface EventMcpToolsChanged {
  type: "mcp.tools.changed";
  properties: {
    server: string;
  };
}

interface EventMcpBrowserOpenFailed {
  type: "mcp.browser.open.failed";
  properties: {
    mcpName: string;
    url: string;
  };
}
```

### MCP Resource (v2)

```typescript
interface McpResource {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  client: string;
}
```

---

## 11. Error Types

### Error Union

```typescript
type MessageError =
  | ProviderAuthError
  | UnknownError
  | MessageOutputLengthError
  | MessageAbortedError
  | ApiError;
```

### Error Definitions

```typescript
interface ProviderAuthError {
  name: "ProviderAuthError";
  data: {
    providerID: string;
    message: string;
  };
}

interface UnknownError {
  name: "UnknownError";
  data: {
    message: string;
  };
}

interface MessageOutputLengthError {
  name: "MessageOutputLengthError";
  data: Record<string, unknown>;
}

interface MessageAbortedError {
  name: "MessageAbortedError";
  data: {
    message: string;
  };
}

interface ApiError {
  name: "APIError";
  data: {
    message: string;
    statusCode?: number;
    isRetryable: boolean;
    responseHeaders?: Record<string, string>;
    responseBody?: string;
    metadata?: Record<string, string>;  // v2
  };
}

interface BadRequestError {
  data: unknown;
  errors: Array<Record<string, unknown>>;
  success: false;
}

interface NotFoundError {
  name: "NotFoundError";
  data: {
    message: string;
  };
}
```

---

## 12. All Enums and Constants

### Event Types

```typescript
const EventTypes = {
  // Server/System
  SERVER_INSTANCE_DISPOSED: "server.instance.disposed",
  SERVER_CONNECTED: "server.connected",
  INSTALLATION_UPDATED: "installation.updated",
  INSTALLATION_UPDATE_AVAILABLE: "installation.update-available",
  GLOBAL_DISPOSED: "global.disposed",
  
  // LSP
  LSP_CLIENT_DIAGNOSTICS: "lsp.client.diagnostics",
  LSP_UPDATED: "lsp.updated",
  
  // Message
  MESSAGE_UPDATED: "message.updated",
  MESSAGE_REMOVED: "message.removed",
  MESSAGE_PART_UPDATED: "message.part.updated",
  MESSAGE_PART_REMOVED: "message.part.removed",
  
  // Session
  SESSION_CREATED: "session.created",
  SESSION_UPDATED: "session.updated",
  SESSION_DELETED: "session.deleted",
  SESSION_IDLE: "session.idle",
  SESSION_STATUS: "session.status",
  SESSION_COMPACTED: "session.compacted",
  SESSION_DIFF: "session.diff",
  SESSION_ERROR: "session.error",
  
  // File
  FILE_EDITED: "file.edited",
  FILE_WATCHER_UPDATED: "file.watcher.updated",
  
  // Permission
  PERMISSION_UPDATED: "permission.updated",
  PERMISSION_ASKED: "permission.asked",
  PERMISSION_REPLIED: "permission.replied",
  
  // VCS
  VCS_BRANCH_UPDATED: "vcs.branch.updated",
  
  // TUI
  TUI_PROMPT_APPEND: "tui.prompt.append",
  TUI_COMMAND_EXECUTE: "tui.command.execute",
  TUI_TOAST_SHOW: "tui.toast.show",
  TUI_SESSION_SELECT: "tui.session.select",
  
  // PTY
  PTY_CREATED: "pty.created",
  PTY_UPDATED: "pty.updated",
  PTY_EXITED: "pty.exited",
  PTY_DELETED: "pty.deleted",
  
  // Todo
  TODO_UPDATED: "todo.updated",
  
  // Command
  COMMAND_EXECUTED: "command.executed",
  
  // Question (v2)
  QUESTION_ASKED: "question.asked",
  QUESTION_REPLIED: "question.replied",
  QUESTION_REJECTED: "question.rejected",
  
  // MCP (v2)
  MCP_TOOLS_CHANGED: "mcp.tools.changed",
  MCP_BROWSER_OPEN_FAILED: "mcp.browser.open.failed",
  
  // Worktree (v2)
  WORKTREE_READY: "worktree.ready",
  WORKTREE_FAILED: "worktree.failed",
  
  // Project (v2)
  PROJECT_UPDATED: "project.updated",
} as const;
```

### Part Types

```typescript
const PartTypes = {
  TEXT: "text",
  SUBTASK: "subtask",
  REASONING: "reasoning",
  FILE: "file",
  TOOL: "tool",
  STEP_START: "step-start",
  STEP_FINISH: "step-finish",
  SNAPSHOT: "snapshot",
  PATCH: "patch",
  AGENT: "agent",
  RETRY: "retry",
  COMPACTION: "compaction",
} as const;
```

### Tool States

```typescript
const ToolStates = {
  PENDING: "pending",
  RUNNING: "running",
  COMPLETED: "completed",
  ERROR: "error",
} as const;
```

### Session Status Types

```typescript
const SessionStatusTypes = {
  IDLE: "idle",
  RETRY: "retry",
  BUSY: "busy",
} as const;
```

### Message Roles

```typescript
const MessageRoles = {
  USER: "user",
  ASSISTANT: "assistant",
} as const;
```

### Permission Actions

```typescript
const PermissionActions = {
  ALLOW: "allow",
  DENY: "deny",
  ASK: "ask",
} as const;

const PermissionResponses = {
  ONCE: "once",
  ALWAYS: "always",
  REJECT: "reject",
} as const;
```

### Agent Modes

```typescript
const AgentModes = {
  SUBAGENT: "subagent",
  PRIMARY: "primary",
  ALL: "all",
} as const;
```

### File Watcher Events

```typescript
const FileWatcherEvents = {
  ADD: "add",
  CHANGE: "change",
  UNLINK: "unlink",
} as const;
```

### File Status

```typescript
const FileStatuses = {
  ADDED: "added",
  DELETED: "deleted",
  MODIFIED: "modified",
} as const;
```

### MCP Status Types

```typescript
const McpStatusTypes = {
  CONNECTED: "connected",
  DISABLED: "disabled",
  FAILED: "failed",
  NEEDS_AUTH: "needs_auth",
  NEEDS_CLIENT_REGISTRATION: "needs_client_registration",
} as const;
```

### PTY Status

```typescript
const PtyStatuses = {
  RUNNING: "running",
  EXITED: "exited",
} as const;
```

### Model Status

```typescript
const ModelStatuses = {
  ALPHA: "alpha",
  BETA: "beta",
  DEPRECATED: "deprecated",
  ACTIVE: "active",
} as const;
```

### Provider Source

```typescript
const ProviderSources = {
  ENV: "env",
  CONFIG: "config",
  CUSTOM: "custom",
  API: "api",
} as const;
```

### Toast Variants

```typescript
const ToastVariants = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
  ERROR: "error",
} as const;
```

### Log Levels

```typescript
const LogLevels = {
  DEBUG: "DEBUG",
  INFO: "INFO",
  WARN: "WARN",
  ERROR: "ERROR",
} as const;
```

### VCS Types

```typescript
const VcsTypes = {
  GIT: "git",
} as const;
```

### Auth Types

```typescript
const AuthTypes = {
  OAUTH: "oauth",
  API: "api",
  WELLKNOWN: "wellknown",
} as const;
```

### Error Names

```typescript
const ErrorNames = {
  PROVIDER_AUTH_ERROR: "ProviderAuthError",
  UNKNOWN_ERROR: "UnknownError",
  MESSAGE_OUTPUT_LENGTH_ERROR: "MessageOutputLengthError",
  MESSAGE_ABORTED_ERROR: "MessageAbortedError",
  API_ERROR: "APIError",
  NOT_FOUND_ERROR: "NotFoundError",
} as const;
```

---

## Quick Reference: Type Imports

```typescript
// Main exports
import {
  createOpencodeClient,
  createOpencode,
  OpencodeClient,
  type OpencodeClientConfig,
} from "@opencode-ai/sdk";

// All types from gen/types.gen
import type {
  // Events
  Event,
  GlobalEvent,
  EventSessionCreated,
  EventSessionUpdated,
  EventSessionDeleted,
  EventSessionIdle,
  EventSessionStatus,
  EventSessionError,
  EventMessageUpdated,
  EventMessageRemoved,
  EventMessagePartUpdated,
  EventMessagePartRemoved,
  EventFileEdited,
  EventFileWatcherUpdated,
  EventPermissionUpdated,
  EventPermissionReplied,
  // ... all other event types
  
  // Messages
  Message,
  UserMessage,
  AssistantMessage,
  
  // Parts
  Part,
  TextPart,
  ReasoningPart,
  FilePart,
  ToolPart,
  StepStartPart,
  StepFinishPart,
  SnapshotPart,
  PatchPart,
  AgentPart,
  SubtaskPart,
  RetryPart,
  CompactionPart,
  
  // Tool States
  ToolState,
  ToolStatePending,
  ToolStateRunning,
  ToolStateCompleted,
  ToolStateError,
  
  // Session
  Session,
  SessionStatus,
  
  // Permission
  Permission,
  PermissionRequest,
  PermissionRule,
  PermissionRuleset,
  
  // Config
  Config,
  AgentConfig,
  ProviderConfig,
  McpLocalConfig,
  McpRemoteConfig,
  
  // Errors
  ProviderAuthError,
  UnknownError,
  MessageOutputLengthError,
  MessageAbortedError,
  ApiError,
  BadRequestError,
  NotFoundError,
  
  // Other
  FileDiff,
  FileContent,
  Model,
  Provider,
  Agent,
  Todo,
  Pty,
  McpStatus,
} from "@opencode-ai/sdk";
```

---

## Version Differences (v1 vs v2)

| Feature | v1 | v2 |
|---------|----|----|
| SubtaskPart.model | No | Yes |
| SubtaskPart.command | No | Yes |
| Session.slug | No | Yes |
| Session.time.archived | No | Yes |
| Session.permission | No | Yes (PermissionRuleset) |
| Agent.native | No | Yes |
| Agent.hidden | No | Yes |
| Agent.steps | No | Yes (replaces maxSteps) |
| AssistantMessage.agent | No | Yes |
| UserMessage.variant | No | Yes |
| ResourceSource | No | Yes |
| EventPermissionAsked | No | Yes (replaces EventPermissionUpdated) |
| Question events | No | Yes |
| MCP events | No | Yes |
| Worktree events | No | Yes |
| EventProjectUpdated | No | Yes |
| EventGlobalDisposed | No | Yes |
| EventTuiSessionSelect | No | Yes |
| Model.family | No | Yes |
| Model.limit.input | No | Yes |
| Model.capabilities.interleaved | No | Yes |
| Path.home | No | Yes |
| Command.source | No | Yes |
| Command.hints | No | Yes |

---

*Generated from @opencode-ai/sdk version 1.1.48*
