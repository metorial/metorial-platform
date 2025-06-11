import { MetorialCoreSDK, MetorialSDK } from '@metorial/core';
import { DashboardInstanceSessionsCreateBody } from '@metorial/generated';
import { MetorialMcpClient } from './mcpClient';
import { MetorialMcpToolManager } from './mcpToolManager';

export interface MetorialMcpSessionInit extends DashboardInstanceSessionsCreateBody {
  client?: {
    name?: string;
    version?: string;
  };
}

export class MetorialMcpSession {
  #sessionPromise: Promise<MetorialSDK.Session>;
  #clientPromises = new Map<string, Promise<MetorialMcpClient>>();

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
