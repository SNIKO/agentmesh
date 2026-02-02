# Claude Agent SDK Analysis

**Package**: `@anthropic-ai/claude-agent-sdk`  
**Version**: 0.2.29  
**Claude Code Version**: 2.1.29

---

## 1. Main Exports

### Core Functions

```typescript
// Main query function - AsyncGenerator for streaming
export declare function query(_params: {
    prompt: string | AsyncIterable<SDKUserMessage>;
    options?: Options;
}): Query;

// Tool definition helper
export declare function tool<Schema extends AnyZodRawShape>(
    _name: string,
    _description: string,
    _inputSchema: Schema,
    _handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>,
    _extras?: { annotations?: ToolAnnotations }
): SdkMcpToolDefinition<Schema>;

// MCP Server factory
export declare function createSdkMcpServer(_options: CreateSdkMcpServerOptions): McpSdkServerConfigWithInstance;

// V2 API (UNSTABLE)
export declare function unstable_v2_createSession(_options: SDKSessionOptions): SDKSession;
export declare function unstable_v2_prompt(_message: string, _options: SDKSessionOptions): Promise<SDKResultMessage>;
export declare function unstable_v2_resumeSession(_sessionId: string, _options: SDKSessionOptions): SDKSession;
```

### Query Interface

```typescript
export declare interface Query extends AsyncGenerator<SDKMessage, void> {
    // Control methods
    interrupt(): Promise<void>;
    setPermissionMode(mode: PermissionMode): Promise<void>;
    setModel(model?: string): Promise<void>;
    setMaxThinkingTokens(maxThinkingTokens: number | null): Promise<void>;
    
    // Information queries
    supportedCommands(): Promise<SlashCommand[]>;
    supportedModels(): Promise<ModelInfo[]>;
    mcpServerStatus(): Promise<McpServerStatus[]>;
    accountInfo(): Promise<AccountInfo>;
    
    // File operations
    rewindFiles(userMessageId: string, options?: { dryRun?: boolean }): Promise<RewindFilesResult>;
    
    // MCP management
    reconnectMcpServer(serverName: string): Promise<void>;
    toggleMcpServer(serverName: string, enabled: boolean): Promise<void>;
    setMcpServers(servers: Record<string, McpServerConfig>): Promise<McpSetServersResult>;
    
    // Stream control
    streamInput(stream: AsyncIterable<SDKUserMessage>): Promise<void>;
    close(): void;
}
```

---

## 2. Options Type (Full)

```typescript
export declare type Options = {
    // Abort control
    abortController?: AbortController;
    
    // Directory access
    additionalDirectories?: string[];
    cwd?: string;
    
    // Agent configuration
    agent?: string;
    agents?: Record<string, AgentDefinition>;
    
    // Tool permissions
    allowedTools?: string[];
    disallowedTools?: string[];
    tools?: string[] | { type: 'preset'; preset: 'claude_code' };
    canUseTool?: CanUseTool;
    
    // Environment
    env?: { [envVar: string]: string | undefined };
    executable?: 'bun' | 'deno' | 'node';
    executableArgs?: string[];
    extraArgs?: Record<string, string | null>;
    
    // Model settings
    model?: string;
    fallbackModel?: string;
    maxThinkingTokens?: number;
    maxTurns?: number;
    maxBudgetUsd?: number;
    
    // Session management
    continue?: boolean;
    resume?: string;
    resumeSessionAt?: string;
    forkSession?: boolean;
    persistSession?: boolean;
    enableFileCheckpointing?: boolean;
    
    // Streaming
    includePartialMessages?: boolean;
    
    // MCP configuration
    mcpServers?: Record<string, McpServerConfig>;
    strictMcpConfig?: boolean;
    
    // Output format
    outputFormat?: OutputFormat;
    
    // Permissions
    permissionMode?: PermissionMode;
    allowDangerouslySkipPermissions?: boolean;
    permissionPromptToolName?: string;
    
    // Plugins & hooks
    plugins?: SdkPluginConfig[];
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    
    // Sandbox
    sandbox?: SandboxSettings;
    
    // Settings sources
    settingSources?: SettingSource[];
    
    // System prompt
    systemPrompt?: string | {
        type: 'preset';
        preset: 'claude_code';
        append?: string;
    };
    
    // Beta features
    betas?: SdkBeta[];  // 'context-1m-2025-08-07'
    
    // Debugging
    stderr?: (data: string) => void;
    pathToClaudeCodeExecutable?: string;
    spawnClaudeCodeProcess?: (options: SpawnOptions) => SpawnedProcess;
};
```

---

## 3. SDKMessage Types (All 16 Types)

```typescript
export declare type SDKMessage = 
    | SDKAssistantMessage 
    | SDKUserMessage 
    | SDKUserMessageReplay 
    | SDKResultMessage 
    | SDKSystemMessage 
    | SDKPartialAssistantMessage 
    | SDKCompactBoundaryMessage 
    | SDKStatusMessage 
    | SDKHookStartedMessage 
    | SDKHookProgressMessage 
    | SDKHookResponseMessage 
    | SDKToolProgressMessage 
    | SDKAuthStatusMessage 
    | SDKTaskNotificationMessage 
    | SDKFilesPersistedEvent 
    | SDKToolUseSummaryMessage;
```

### Individual Message Types

```typescript
// Assistant message with BetaMessage content
export declare type SDKAssistantMessage = {
    type: 'assistant';
    message: BetaMessage;
    parent_tool_use_id: string | null;
    error?: SDKAssistantMessageError;
    uuid: UUID;
    session_id: string;
};

export declare type SDKAssistantMessageError = 
    | 'authentication_failed' 
    | 'billing_error' 
    | 'rate_limit' 
    | 'invalid_request' 
    | 'server_error' 
    | 'unknown';

// User messages
export declare type SDKUserMessage = {
    type: 'user';
    message: MessageParam;
    parent_tool_use_id: string | null;
    isSynthetic?: boolean;
    tool_use_result?: unknown;
    uuid?: UUID;
    session_id: string;
};

export declare type SDKUserMessageReplay = {
    type: 'user';
    message: MessageParam;
    parent_tool_use_id: string | null;
    isSynthetic?: boolean;
    tool_use_result?: unknown;
    uuid: UUID;
    session_id: string;
    isReplay: true;
};

// Streaming partial message
export declare type SDKPartialAssistantMessage = {
    type: 'stream_event';
    event: BetaRawMessageStreamEvent;
    parent_tool_use_id: string | null;
    uuid: UUID;
    session_id: string;
};

// System init message
export declare type SDKSystemMessage = {
    type: 'system';
    subtype: 'init';
    agents?: string[];
    apiKeySource: ApiKeySource;
    betas?: string[];
    claude_code_version: string;
    cwd: string;
    tools: string[];
    mcp_servers: { name: string; status: string; }[];
    model: string;
    permissionMode: PermissionMode;
    slash_commands: string[];
    output_style: string;
    skills: string[];
    plugins: { name: string; path: string; }[];
    uuid: UUID;
    session_id: string;
};

// Status message
export declare type SDKStatusMessage = {
    type: 'system';
    subtype: 'status';
    status: SDKStatus;  // 'compacting' | null
    permissionMode?: PermissionMode;
    uuid: UUID;
    session_id: string;
};

// Compact boundary
export declare type SDKCompactBoundaryMessage = {
    type: 'system';
    subtype: 'compact_boundary';
    compact_metadata: {
        trigger: 'manual' | 'auto';
        pre_tokens: number;
    };
    uuid: UUID;
    session_id: string;
};

// Tool progress
export declare type SDKToolProgressMessage = {
    type: 'tool_progress';
    tool_use_id: string;
    tool_name: string;
    parent_tool_use_id: string | null;
    elapsed_time_seconds: number;
    uuid: UUID;
    session_id: string;
};

// Tool use summary
export declare type SDKToolUseSummaryMessage = {
    type: 'tool_use_summary';
    summary: string;
    preceding_tool_use_ids: string[];
    uuid: UUID;
    session_id: string;
};

// Task notification (background tasks)
export declare type SDKTaskNotificationMessage = {
    type: 'system';
    subtype: 'task_notification';
    task_id: string;
    status: 'completed' | 'failed' | 'stopped';
    output_file: string;
    summary: string;
    uuid: UUID;
    session_id: string;
};

// Auth status
export declare type SDKAuthStatusMessage = {
    type: 'auth_status';
    isAuthenticating: boolean;
    output: string[];
    error?: string;
    uuid: UUID;
    session_id: string;
};

// Files persisted
export declare type SDKFilesPersistedEvent = {
    type: 'system';
    subtype: 'files_persisted';
    files: { filename: string; file_id: string; }[];
    failed: { filename: string; error: string; }[];
    processed_at: string;
    uuid: UUID;
    session_id: string;
};

// Hook messages
export declare type SDKHookStartedMessage = {
    type: 'system';
    subtype: 'hook_started';
    hook_id: string;
    hook_name: string;
    hook_event: string;
    uuid: UUID;
    session_id: string;
};

export declare type SDKHookProgressMessage = {
    type: 'system';
    subtype: 'hook_progress';
    hook_id: string;
    hook_name: string;
    hook_event: string;
    stdout: string;
    stderr: string;
    output: string;
    uuid: UUID;
    session_id: string;
};

export declare type SDKHookResponseMessage = {
    type: 'system';
    subtype: 'hook_response';
    hook_id: string;
    hook_name: string;
    hook_event: string;
    output: string;
    stdout: string;
    stderr: string;
    exit_code?: number;
    outcome: 'success' | 'error' | 'cancelled';
    uuid: UUID;
    session_id: string;
};
```

---

## 4. Result Types

```typescript
export declare type SDKResultMessage = SDKResultSuccess | SDKResultError;

export declare type SDKResultSuccess = {
    type: 'result';
    subtype: 'success';
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    result: string;
    total_cost_usd: number;
    usage: NonNullableUsage;
    modelUsage: Record<string, ModelUsage>;
    permission_denials: SDKPermissionDenial[];
    structured_output?: unknown;
    uuid: UUID;
    session_id: string;
};

export declare type SDKResultError = {
    type: 'result';
    subtype: 'error_during_execution' 
           | 'error_max_turns' 
           | 'error_max_budget_usd' 
           | 'error_max_structured_output_retries';
    duration_ms: number;
    duration_api_ms: number;
    is_error: boolean;
    num_turns: number;
    total_cost_usd: number;
    usage: NonNullableUsage;
    modelUsage: Record<string, ModelUsage>;
    permission_denials: SDKPermissionDenial[];
    errors: string[];
    uuid: UUID;
    session_id: string;
};

export declare type SDKPermissionDenial = {
    tool_name: string;
    tool_use_id: string;
    tool_input: Record<string, unknown>;
};
```

---

## 5. Usage & Stats Types

```typescript
// From @anthropic-ai/sdk (re-exported)
export declare type NonNullableUsage = {
    [K in keyof BetaUsage]: NonNullable<BetaUsage[K]>;
};
// Fields: input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens

// Per-model usage tracking
export declare type ModelUsage = {
    inputTokens: number;
    outputTokens: number;
    cacheReadInputTokens: number;
    cacheCreationInputTokens: number;
    webSearchRequests: number;
    costUSD: number;
    contextWindow: number;
    maxOutputTokens: number;
};

// Account info
export declare type AccountInfo = {
    email?: string;
    organization?: string;
    subscriptionType?: string;
    tokenSource?: string;
    apiKeySource?: string;
};

// Model info
export declare type ModelInfo = {
    value: string;
    displayName: string;
    description: string;
};
```

---

## 6. Built-in Tool Input Schemas

All tool inputs from `sdk-tools.d.ts`:

```typescript
export type ToolInputSchemas =
    | AgentInput
    | BashInput
    | TaskOutputInput
    | ExitPlanModeInput
    | FileEditInput
    | FileReadInput
    | FileWriteInput
    | GlobInput
    | GrepInput
    | TaskStopInput
    | ListMcpResourcesInput
    | McpInput
    | NotebookEditInput
    | ReadMcpResourceInput
    | TodoWriteInput
    | WebFetchInput
    | WebSearchInput
    | AskUserQuestionInput
    | ConfigInput;
```

### Bash Tool

```typescript
export interface BashInput {
    command: string;
    timeout?: number;  // max 600000ms
    description?: string;
    run_in_background?: boolean;
    dangerouslyDisableSandbox?: boolean;
    _simulatedSedEdit?: { filePath: string; newContent: string; };
}
```

### File Tools

```typescript
export interface FileReadInput {
    file_path: string;  // absolute path
    offset?: number;    // start line
    limit?: number;     // number of lines
}

export interface FileWriteInput {
    file_path: string;  // absolute path
    content: string;
}

export interface FileEditInput {
    file_path: string;
    old_string: string;
    new_string: string;
    replace_all?: boolean;  // default false
}
```

### Search Tools

```typescript
export interface GlobInput {
    pattern: string;
    path?: string;  // defaults to cwd
}

export interface GrepInput {
    pattern: string;     // regex pattern
    path?: string;       // file or directory
    glob?: string;       // file filter e.g. "*.ts"
    output_mode?: 'content' | 'files_with_matches' | 'count';
    '-B'?: number;       // lines before
    '-A'?: number;       // lines after
    '-C'?: number;       // context lines
    context?: number;
    '-n'?: boolean;      // line numbers
    '-i'?: boolean;      // case insensitive
    type?: string;       // file type (js, py, rust, etc.)
    head_limit?: number;
    offset?: number;
    multiline?: boolean;
}
```

### Agent Tool (Subagent)

```typescript
export interface AgentInput {
    description: string;  // 3-5 word description
    prompt: string;
    subagent_type: string;
    model?: 'sonnet' | 'opus' | 'haiku';
    resume?: string;      // agent ID to resume
    run_in_background?: boolean;
    max_turns?: number;
    name?: string;
    team_name?: string;
    mode?: 'acceptEdits' | 'bypassPermissions' | 'default' | 'delegate' | 'dontAsk' | 'plan';
}
```

### Background Task Tools

```typescript
export interface TaskOutputInput {
    task_id: string;
    block: boolean;
    timeout: number;
}

export interface TaskStopInput {
    task_id?: string;
    shell_id?: string;  // deprecated
}
```

### Notebook Tool

```typescript
export interface NotebookEditInput {
    notebook_path: string;  // absolute path
    cell_id?: string;
    new_source: string;
    cell_type?: 'code' | 'markdown';
    edit_mode?: 'replace' | 'insert' | 'delete';
}
```

### Web Tools

```typescript
export interface WebFetchInput {
    url: string;
    prompt: string;
}

export interface WebSearchInput {
    query: string;
    allowed_domains?: string[];
    blocked_domains?: string[];
}
```

### MCP Resource Tools

```typescript
export interface ListMcpResourcesInput {
    server?: string;
}

export interface ReadMcpResourceInput {
    server: string;
    uri: string;
}

export interface McpInput {
    [k: string]: unknown;
}
```

### User Interaction Tools

```typescript
export interface TodoWriteInput {
    todos: {
        content: string;
        status: 'pending' | 'in_progress' | 'completed';
        activeForm: string;
    }[];
}

export interface AskUserQuestionInput {
    questions: Array<{
        question: string;
        header: string;  // max 12 chars
        options: Array<{ label: string; description: string; }>;  // 2-4 options
        multiSelect: boolean;
    }>;  // 1-4 questions
    answers?: Record<string, string>;
    metadata?: { source?: string; };
}

export interface ConfigInput {
    setting: string;
    value?: string | boolean | number;
}

export interface ExitPlanModeInput {
    allowedPrompts?: Array<{ tool: 'Bash'; prompt: string; }>;
    pushToRemote?: boolean;
    remoteSessionId?: string;
    remoteSessionUrl?: string;
    remoteSessionTitle?: string;
}
```

---

## 7. Subagent/Task Support

### Agent Definition

```typescript
export declare type AgentDefinition = {
    description: string;
    tools?: string[];
    disallowedTools?: string[];
    prompt: string;
    model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';
    mcpServers?: AgentMcpServerSpec[];
    criticalSystemReminder_EXPERIMENTAL?: string;
    skills?: string[];
    maxTurns?: number;
};

export declare type AgentMcpServerSpec = string | Record<string, McpServerConfigForProcessTransport>;
```

---

## 8. Permission System

### Permission Callback

```typescript
export declare type CanUseTool = (
    toolName: string,
    input: Record<string, unknown>,
    options: {
        signal: AbortSignal;
        suggestions?: PermissionUpdate[];
        blockedPath?: string;
        decisionReason?: string;
        toolUseID: string;
        agentID?: string;
    }
) => Promise<PermissionResult>;

export declare type PermissionResult = 
    | { behavior: 'allow'; updatedInput?: Record<string, unknown>; updatedPermissions?: PermissionUpdate[]; toolUseID?: string; }
    | { behavior: 'deny'; message: string; interrupt?: boolean; toolUseID?: string; };
```

### Permission Updates

```typescript
export declare type PermissionUpdate = 
    | { type: 'addRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination; }
    | { type: 'replaceRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination; }
    | { type: 'removeRules'; rules: PermissionRuleValue[]; behavior: PermissionBehavior; destination: PermissionUpdateDestination; }
    | { type: 'setMode'; mode: PermissionMode; destination: PermissionUpdateDestination; }
    | { type: 'addDirectories'; directories: string[]; destination: PermissionUpdateDestination; }
    | { type: 'removeDirectories'; directories: string[]; destination: PermissionUpdateDestination; };

export declare type PermissionBehavior = 'allow' | 'deny' | 'ask';

export declare type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk';

export declare type PermissionUpdateDestination = 'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg';

export declare type PermissionRuleValue = {
    toolName: string;
    ruleContent?: string;
};
```

---

## 9. Hook System

### Hook Events

```typescript
export declare const HOOK_EVENTS: readonly [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'Notification',
    'UserPromptSubmit',
    'SessionStart',
    'SessionEnd',
    'Stop',
    'SubagentStart',
    'SubagentStop',
    'PreCompact',
    'PermissionRequest',
    'Setup'
];

export declare type HookEvent = typeof HOOK_EVENTS[number];
```

### Hook Callback

```typescript
export declare type HookCallback = (
    input: HookInput,
    toolUseID: string | undefined,
    options: { signal: AbortSignal }
) => Promise<HookJSONOutput>;

export declare interface HookCallbackMatcher {
    matcher?: string;
    hooks: HookCallback[];
    timeout?: number;
}
```

### Hook Inputs (by event)

```typescript
export declare type BaseHookInput = {
    session_id: string;
    transcript_path: string;
    cwd: string;
    permission_mode?: string;
};

// Tool hooks
export declare type PreToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PreToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
};

export declare type PostToolUseHookInput = BaseHookInput & {
    hook_event_name: 'PostToolUse';
    tool_name: string;
    tool_input: unknown;
    tool_response: unknown;
    tool_use_id: string;
};

export declare type PostToolUseFailureHookInput = BaseHookInput & {
    hook_event_name: 'PostToolUseFailure';
    tool_name: string;
    tool_input: unknown;
    tool_use_id: string;
    error: string;
    is_interrupt?: boolean;
};

// Session hooks
export declare type SessionStartHookInput = BaseHookInput & {
    hook_event_name: 'SessionStart';
    source: 'startup' | 'resume' | 'clear' | 'compact';
    agent_type?: string;
    model?: string;
};

export declare type SessionEndHookInput = BaseHookInput & {
    hook_event_name: 'SessionEnd';
    reason: ExitReason;
};

// Subagent hooks
export declare type SubagentStartHookInput = BaseHookInput & {
    hook_event_name: 'SubagentStart';
    agent_id: string;
    agent_type: string;
};

export declare type SubagentStopHookInput = BaseHookInput & {
    hook_event_name: 'SubagentStop';
    stop_hook_active: boolean;
    agent_id: string;
    agent_transcript_path: string;
    agent_type: string;
};

// Other hooks
export declare type UserPromptSubmitHookInput = BaseHookInput & {
    hook_event_name: 'UserPromptSubmit';
    prompt: string;
};

export declare type NotificationHookInput = BaseHookInput & {
    hook_event_name: 'Notification';
    message: string;
    title?: string;
    notification_type: string;
};

export declare type PermissionRequestHookInput = BaseHookInput & {
    hook_event_name: 'PermissionRequest';
    tool_name: string;
    tool_input: unknown;
    permission_suggestions?: PermissionUpdate[];
};

export declare type StopHookInput = BaseHookInput & {
    hook_event_name: 'Stop';
    stop_hook_active: boolean;
};

export declare type PreCompactHookInput = BaseHookInput & {
    hook_event_name: 'PreCompact';
    trigger: 'manual' | 'auto';
    custom_instructions: string | null;
};

export declare type SetupHookInput = BaseHookInput & {
    hook_event_name: 'Setup';
    trigger: 'init' | 'maintenance';
};
```

### Hook Outputs

```typescript
export declare type HookJSONOutput = AsyncHookJSONOutput | SyncHookJSONOutput;

export declare type AsyncHookJSONOutput = {
    async: true;
    asyncTimeout?: number;
};

export declare type SyncHookJSONOutput = {
    continue?: boolean;
    suppressOutput?: boolean;
    stopReason?: string;
    decision?: 'approve' | 'block';
    systemMessage?: string;
    reason?: string;
    hookSpecificOutput?: PreToolUseHookSpecificOutput | /* ... other outputs */;
};

export declare type PreToolUseHookSpecificOutput = {
    hookEventName: 'PreToolUse';
    permissionDecision?: 'allow' | 'deny' | 'ask';
    permissionDecisionReason?: string;
    updatedInput?: Record<string, unknown>;
    additionalContext?: string;
};
```

---

## 10. MCP Server Configuration

```typescript
export declare type McpServerConfig = 
    | McpStdioServerConfig 
    | McpSSEServerConfig 
    | McpHttpServerConfig 
    | McpSdkServerConfigWithInstance;

export declare type McpStdioServerConfig = {
    type?: 'stdio';
    command: string;
    args?: string[];
    env?: Record<string, string>;
};

export declare type McpSSEServerConfig = {
    type: 'sse';
    url: string;
    headers?: Record<string, string>;
};

export declare type McpHttpServerConfig = {
    type: 'http';
    url: string;
    headers?: Record<string, string>;
};

export declare type McpSdkServerConfig = {
    type: 'sdk';
    name: string;
};

export declare type McpSdkServerConfigWithInstance = McpSdkServerConfig & {
    instance: McpServer;  // from @modelcontextprotocol/sdk
};

export declare type McpClaudeAIProxyServerConfig = {
    type: 'claudeai-proxy';
    url: string;
    id: string;
};

export declare type McpServerStatus = {
    name: string;
    status: 'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled';
    serverInfo?: { name: string; version: string; };
    error?: string;
    config?: McpServerStatusConfig;
    scope?: string;
    tools?: Array<{
        name: string;
        description?: string;
        annotations?: { readOnly?: boolean; destructive?: boolean; openWorld?: boolean; };
    }>;
};

export declare type McpSetServersResult = {
    added: string[];
    removed: string[];
    errors: Record<string, string>;
};
```

---

## 11. Sandbox Settings

```typescript
export declare type SandboxSettings = {
    enabled?: boolean;
    autoAllowBashIfSandboxed?: boolean;
    allowUnsandboxedCommands?: boolean;
    network?: SandboxNetworkConfig;
    ignoreViolations?: Record<string, string[]>;
    enableWeakerNestedSandbox?: boolean;
    excludedCommands?: string[];
    ripgrep?: { command: string; args?: string[]; };
};

export declare type SandboxNetworkConfig = {
    allowedDomains?: string[];
    allowUnixSockets?: string[];
    allowAllUnixSockets?: boolean;
    allowLocalBinding?: boolean;
    httpProxyPort?: number;
    socksProxyPort?: number;
};
```

---

## 12. All Enums and String Literals

### Permission Modes
```typescript
'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'delegate' | 'dontAsk'
```

### Permission Behaviors
```typescript
'allow' | 'deny' | 'ask'
```

### Permission Destinations
```typescript
'userSettings' | 'projectSettings' | 'localSettings' | 'session' | 'cliArg'
```

### Setting Sources
```typescript
'user' | 'project' | 'local'
```

### Config Scopes
```typescript
'local' | 'user' | 'project'
```

### Exit Reasons
```typescript
'clear' | 'logout' | 'prompt_input_exit' | 'other' | 'bypass_permissions_disabled'
```

### API Key Sources
```typescript
'user' | 'project' | 'org' | 'temporary'
```

### Agent Models
```typescript
'sonnet' | 'opus' | 'haiku' | 'inherit'
```

### MCP Server Status
```typescript
'connected' | 'failed' | 'needs-auth' | 'pending' | 'disabled'
```

### Executables
```typescript
'bun' | 'deno' | 'node'
```

### Assistant Message Errors
```typescript
'authentication_failed' | 'billing_error' | 'rate_limit' | 'invalid_request' | 'server_error' | 'unknown'
```

### Result Subtypes
```typescript
'success' | 'error_during_execution' | 'error_max_turns' | 'error_max_budget_usd' | 'error_max_structured_output_retries'
```

### SDK Status
```typescript
'compacting' | null
```

### Hook Outcomes
```typescript
'success' | 'error' | 'cancelled'
```

### Task Status
```typescript
'completed' | 'failed' | 'stopped'
```

### Compact Triggers
```typescript
'manual' | 'auto'
```

### Session Start Sources
```typescript
'startup' | 'resume' | 'clear' | 'compact'
```

### Grep Output Modes
```typescript
'content' | 'files_with_matches' | 'count'
```

### Notebook Cell Types
```typescript
'code' | 'markdown'
```

### Notebook Edit Modes
```typescript
'replace' | 'insert' | 'delete'
```

### Todo Status
```typescript
'pending' | 'in_progress' | 'completed'
```

### Setup Triggers
```typescript
'init' | 'maintenance'
```

### Beta Features
```typescript
'context-1m-2025-08-07'
```

---

## 13. V2 Session API (Unstable)

```typescript
export declare interface SDKSession {
    readonly sessionId: string;
    send(message: string | SDKUserMessage): Promise<void>;
    stream(): AsyncGenerator<SDKMessage, void>;
    close(): void;
    [Symbol.asyncDispose](): Promise<void>;
}

export declare type SDKSessionOptions = {
    model: string;
    pathToClaudeCodeExecutable?: string;
    executable?: 'node' | 'bun';
    executableArgs?: string[];
    env?: { [envVar: string]: string | undefined };
    allowedTools?: string[];
    disallowedTools?: string[];
    canUseTool?: CanUseTool;
    hooks?: Partial<Record<HookEvent, HookCallbackMatcher[]>>;
    permissionMode?: PermissionMode;
};
```

---

## 14. Supporting Types

### Slash Commands (Skills)
```typescript
export declare type SlashCommand = {
    name: string;
    description: string;
    argumentHint: string;
};
```

### Rewind Files
```typescript
export declare type RewindFilesResult = {
    canRewind: boolean;
    error?: string;
    filesChanged?: string[];
    insertions?: number;
    deletions?: number;
};
```

### Plugin Config
```typescript
export declare type SdkPluginConfig = {
    type: 'local';
    path: string;
};
```

### Output Format
```typescript
export declare type OutputFormat = JsonSchemaOutputFormat;

export declare type JsonSchemaOutputFormat = {
    type: 'json_schema';
    schema: Record<string, unknown>;
};

export declare type OutputFormatType = 'json_schema';
```

### Spawn Options
```typescript
export declare interface SpawnOptions {
    command: string;
    args: string[];
    cwd?: string;
    env: { [envVar: string]: string | undefined };
    signal: AbortSignal;
}

export declare interface SpawnedProcess {
    stdin: Writable;
    stdout: Readable;
    readonly killed: boolean;
    readonly exitCode: number | null;
    kill(signal: NodeJS.Signals): boolean;
    on(event: 'exit', listener: (code: number | null, signal: NodeJS.Signals | null) => void): void;
    on(event: 'error', listener: (error: Error) => void): void;
    once(event: 'exit', listener: ...): void;
    once(event: 'error', listener: ...): void;
    off(event: 'exit', listener: ...): void;
    off(event: 'error', listener: ...): void;
}
```

### MCP Tool Definition
```typescript
export declare type SdkMcpToolDefinition<Schema extends AnyZodRawShape = AnyZodRawShape> = {
    name: string;
    description: string;
    inputSchema: Schema;
    annotations?: ToolAnnotations;
    handler: (args: InferShape<Schema>, extra: unknown) => Promise<CallToolResult>;
};

export declare type InferShape<T extends AnyZodRawShape> = {
    [K in keyof T]: T[K] extends { _output: infer O } ? O : never;
} & {};
```

### Transport Interface
```typescript
export declare interface Transport {
    write(data: string): void | Promise<void>;
    close(): void;
    isReady(): boolean;
    readMessages(): AsyncGenerator<StdoutMessage, void, unknown>;
    endInput(): void;
}
```

---

## 15. External Type Dependencies

From `@anthropic-ai/sdk`:
- `BetaMessage` - Full assistant message content
- `BetaRawMessageStreamEvent` - Stream delta events
- `BetaUsage` - Token usage stats
- `MessageParam` - User message format

From `@modelcontextprotocol/sdk`:
- `CallToolResult` - Tool execution result
- `JSONRPCMessage` - MCP protocol message
- `McpServer` - MCP server instance
- `ToolAnnotations` - Tool metadata

From `zod`:
- `ZodRawShape` - Schema shape type (both v3 and v4)
- `z` - Zod namespace (v4)

From Node.js:
- `UUID` from `crypto`
- `Readable`, `Writable` from `stream`
