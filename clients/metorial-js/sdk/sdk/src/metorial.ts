import { MetorialCoreSDK, createMetorialCoreSDK } from '@metorial/core';
import {
  MetorialMcpSession,
  MetorialMcpSessionInit,
  MetorialMcpSessionInitServerDeployments
} from '@metorial/mcp-session';

export class Metorial implements MetorialCoreSDK {
  private readonly sdk: MetorialCoreSDK;

  constructor(init: Parameters<typeof createMetorialCoreSDK>[0]) {
    this.sdk = createMetorialCoreSDK(init);
  }

  get instance() {
    return this.sdk.instance;
  }

  get secrets() {
    return this.sdk.secrets;
  }

  get servers() {
    return this.sdk.servers;
  }

  get sessions() {
    return this.sdk.sessions;
  }

  get _config() {
    return this.sdk._config;
  }

  get mcp() {
    return {
      createSession: (init: MetorialMcpSessionInit) => new MetorialMcpSession(this.sdk, init),
      withSession: this.withSession.bind(this),
      withProviderSession: this.withProviderSession.bind(this),
      createConnection: this.createMcpConnection.bind(this)
    };
  }

  async createMcpConnection(init: MetorialMcpSessionInitServerDeployments[number]) {
    let session = new MetorialMcpSession(this.sdk, {
      serverDeployments: [init]
    });

    let deployments = await session.getServerDeployments();

    return await session.getClient({
      deploymentId: deployments[0].id
    });
  }

  async withSession<T>(
    init: MetorialMcpSessionInit,
    action: (session: MetorialMcpSession) => Promise<T>
  ): Promise<T> {
    let session = new MetorialMcpSession(this.sdk, init);
    try {
      return await action(session);
    } finally {
      await session.close();
    }
  }

  async withProviderSession<P, T>(
    provider: (session: MetorialMcpSession) => Promise<P>,
    init: MetorialMcpSessionInit,
    action: (
      input: P & {
        session: MetorialMcpSession;
        getSession: MetorialMcpSession['getSession'];
        getCapabilities: MetorialMcpSession['getCapabilities'];
        getClient: MetorialMcpSession['getClient'];
        getServerDeployments: MetorialMcpSession['getServerDeployments'];
        getToolManager: MetorialMcpSession['getToolManager'];
      }
    ) => Promise<T>
  ): Promise<T> {
    return this.withSession(init, async session => {
      let providerData = await provider(session);

      return action({
        ...providerData,

        session,

        getSession: session.getSession.bind(session),
        getCapabilities: session.getCapabilities.bind(session),
        getClient: session.getClient.bind(session),
        getServerDeployments: session.getServerDeployments.bind(session),
        getToolManager: session.getToolManager.bind(session)
      });
    });
  }
}
