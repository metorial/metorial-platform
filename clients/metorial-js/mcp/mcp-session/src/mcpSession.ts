import { MetorialCoreSDK, MetorialSDK } from '@metorial/core';
import { DashboardInstanceSessionsCreateBody } from '@metorial/generated';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { MetorialMcpToolManager } from './mcpToolManager';

export interface MetorialMcpSessionInit extends DashboardInstanceSessionsCreateBody {
  client?: {
    name?: string;
    version?: string;
  };
}

export class MetorialMcpSession {
  #sessionPromise: Promise<MetorialSDK.Session>;
  #clientPromises = new Map<string, Promise<Client>>();

  constructor(
    private readonly sdk: MetorialCoreSDK,
    private readonly init: MetorialMcpSessionInit
  ) {
    this.#sessionPromise = this.sdk.sessions.create({
      serverDeployments: init.serverDeployments
    });
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

    return this.sdk.servers.capabilities.list({
      serverDeploymentIds: deployments.map(d => d.id)
    });
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
      this.#clientPromises.set(
        opts.deploymentId,
        (async () => {
          let session = await this.getSession();

          let client = new Client({
            name: this.init.client?.name ?? 'metorial-js-client',
            version: this.init.client?.version ?? '1.0.0'
          });
          let transport = new SSEClientTransport(
            new URL(
              `/mcp/${session.id}/${opts.deploymentId}/sse?key=${session.clientSecret.secret}`,
              this.mcpHost
            )
          );

          await client.connect(transport);

          return client;
        })()
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
