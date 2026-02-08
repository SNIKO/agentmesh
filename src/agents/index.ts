import { createCodexAgent } from "./agent-codex.ts"
import { createCopilotAgent } from "./agent-copilot.ts"
import type { Agent, AgentConfig } from "./types.ts"

/**
 * Create an agent instance for the specified provider.
 *
 * @example
 * ```typescript
 * const agent = createAgent({
 *   provider: 'copilot',
 *   model: 'gpt-5.2',
 * });
 *
 * for await (const event of agent.run({ messages: [{ role: 'user', content: 'Hello' }] })) {
 *   console.log(event.type);
 * }
 * ```
 */
export function createAgent(config: AgentConfig): Agent {
  switch (config.provider) {
    case "copilot":
      return createCopilotAgent(config)

    case "codex":
      return createCodexAgent(config)

    case "opencode":
      throw new Error("OpenCode adapter not implemented yet")

    case "claude":
      throw new Error("Claude adapter not implemented yet")

    default:
      throw new Error(`Unknown provider: ${config.provider}`)
  }
}

export type * from "./types.ts"
