import { MetorialSDK } from '@metorial/core';
import { MetorialMcpSession } from './mcpSession';
import { MetorialMcpTool } from './mcpTool';

export class MetorialMcpToolManager {
  #tools = new Map<string, MetorialMcpTool>();

  private constructor(
    private readonly session: MetorialMcpSession,
    tools: MetorialMcpTool[]
  ) {
    for (let tool of tools) {
      this.#tools.set(tool.id, tool);
      this.#tools.set(tool.name, tool);
    }
  }

  static async fromCapabilities(
    session: MetorialMcpSession,
    capabilities: MetorialSDK.ServerCapabilities
  ) {
    let tools = [
      ...capabilities.tools.map(tool => MetorialMcpTool.fromTool(session, capabilities, tool)),
      ...capabilities.resourceTemplates.map(resourceTemplate =>
        MetorialMcpTool.fromResourceTemplate(session, capabilities, resourceTemplate)
      )
    ];

    return new MetorialMcpToolManager(session, tools);
  }

  getTool(idOrName: string): MetorialMcpTool | undefined {
    return this.#tools.get(idOrName);
  }

  getTools(): MetorialMcpTool[] {
    return Array.from(this.#tools.values());
  }

  callTool(idOrName: string, args: any): Promise<any> {
    let tool = this.getTool(idOrName);
    if (!tool) throw new Error(`Tool not found: ${idOrName}`);
    return tool.call(args);
  }
}
