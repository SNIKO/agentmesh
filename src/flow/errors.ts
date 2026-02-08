import type { Message } from "../types.ts"

export class FlowError extends Error {
  public readonly name = "FlowError"

  constructor(
    message: string,
    public readonly nodeName: string,
    public readonly agentId: string,
    public readonly cause?: Error,
    public readonly partialMessages?: Message[],
  ) {
    super(message)
  }
}
