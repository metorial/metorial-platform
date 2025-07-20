import { MetorialCoreSDK, MetorialSDK } from '@metorial/core';
import { DashboardInstanceSessionsCreateBody } from '@metorial/generated';
import { MetorialMcpClient } from './mcpClient';
import { Capability } from './mcpTool';
import { MetorialMcpToolManager } from './mcpToolManager';

export type MetorialMcpSessionInitServerDeployments = (DashboardInstanceSessionsCreateBody & {
  serverDeploymentIds?: never;
})['serverDeployments'];

export type MetorialMcpSessionInit = {
  serverDeployments: MetorialMcpSessionInitServerDeployments;
  client?: {
    name?: string;
    version?: string;
  };
};

export class MetorialMcpSession {
  #sessionPromise: Promise<MetorialSDK.Session>;
  #clientPromises = new Map<string, Promise<MetorialMcpClient>>();

  constructor(
    private readonly sdk: MetorialCoreSDK,
    private readonly init: MetorialMcpSessionInit
  ) {
    this.#sessionPromise = this.sdk.sessions.create(init);
  }

  async getSession() {
    return await this.#sessionPromise;
  }

  async getServerDeployments() {
    let session = await this.getSession();
    return session.serverDeployments;
  }

  async getCapabilities() {
    let deployments = await this.getServerDeployments();

    let capabilities = await this.sdk.servers.capabilities.list({
      serverDeploymentId: deployments.map(d => d.id)
    });

    let serversMap = new Map(capabilities.mcpServers.map(server => [server.id, server]));

    let capabilitiesByDeploymentId = new Map<string, Capability[]>();
    for (let capability of capabilities.tools) {
      let server = serversMap.get(capability.mcpServerId);
      if (!server || !server.serverDeployment) continue;

      let current = capabilitiesByDeploymentId.get(server.serverDeployment.id) || [];
      current.push({
        type: 'tool',
        tool: capability,
        serverDeployment: server.serverDeployment
      });

      capabilitiesByDeploymentId.set(server.serverDeployment.id, current);
    }

    for (let capability of capabilities.resourceTemplates) {
      let server = serversMap.get(capability.mcpServerId);
      if (!server || !server.serverDeployment) continue;

      let current = capabilitiesByDeploymentId.get(server.serverDeployment.id) || [];
      current.push({
        type: 'resource-template',
        resourceTemplate: capability,
        serverDeployment: server.serverDeployment
      });

      capabilitiesByDeploymentId.set(server.serverDeployment.id, current);
    }

    let deploymentCapabilities = await Promise.all(
      deployments.map(async deployment => {
        let capabilities = capabilitiesByDeploymentId.get(deployment.id);
        if (!capabilities) capabilities = [];

        // Metorial has auto-discovered capabilities, so we
        // don't need to do it again.
        if (capabilities.length) return capabilities;

        // Get a client to manually fetch capabilities using MCP
        let client = await this.getClient({ deploymentId: deployment.id });

        try {
          let tools = await client.listTools();

          capabilities.push(
            ...tools.tools.map(tool => ({
              type: 'tool' as const,
              tool: {
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              },
              serverDeployment: deployment as any
            }))
          );
        } catch (error) {
          // Maybe the server doesn't support tool listing.
        }

        try {
          let resourceTemplates = await client.listResourceTemplates();

          capabilities.push(
            ...resourceTemplates.resourceTemplates.map(resourceTemplate => ({
              type: 'resource-template' as const,
              resourceTemplate: {
                name: resourceTemplate.name,
                description: resourceTemplate.description,
                uriTemplate: resourceTemplate.uriTemplate
              },
              serverDeployment: deployment as any
            }))
          );
        } catch (error) {
          // Maybe the server doesn't support resource templates.
        }

        return capabilities;
      })
    );

    return Array.from(deploymentCapabilities.values()).flat();
  }

  async getToolManager() {
    return MetorialMcpToolManager.fromCapabilities(this, await this.getCapabilities());
  }

  async close() {
    await Promise.all(
      Array.from(this.#clientPromises.values()).map(clientPromise =>
        clientPromise.then(client => client.close())
      )
    );
  }

  async getClient(opts: { deploymentId: string }) {
    if (!this.#clientPromises.has(opts.deploymentId)) {
      let session = await this.getSession();

      this.#clientPromises.set(
        opts.deploymentId,
        MetorialMcpClient.create(session, {
          host: this.mcpHost,
          deploymentId: opts.deploymentId,
          clientName: this.init.client?.name,
          clientVersion: this.init.client?.version
        })
      );
    }

    return await this.#clientPromises.get(opts.deploymentId)!;
  }

  private get mcpHost() {
    if (this.sdk._config.mcpHost) return this.sdk._config.mcpHost;

    let host = this.sdk._config.apiHost;

    if (host.startsWith('https://api.metorial')) {
      return host.replace('https://api.metorial', 'https://mcp.metorial');
    }

    let url = new URL(host);
    url.port = '3311';
    return url.toString();
  }
}
