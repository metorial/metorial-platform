import { createLock } from '@lowerdeck/lock';
import { Service } from '@lowerdeck/service';
import {
  db,
  messageOutputToToolCall,
  type Environment,
  type Session,
  type Tenant
} from '@metorial-subspace/db';
import { SenderManager } from '@metorial-subspace/module-connection';
import { checkTenant, getMetorialSolution } from '@metorial-subspace/module-tenant';
import { env } from '../env';
import {
  assertSessionInternalAdapter,
  type InternalAdapterInput
} from './_shared/internalAdapter';

let connectionInitLock = createLock({
  name: 'sub/ses/internalToolCall/connection/init',
  redisUrl: env.service.REDIS_URL
});

export type InternalToolCallClient = {
  identifier: string;
  name: string;
  privateMetadata?: Record<string, any>;
};

export type CallInternalToolParams = {
  tenant: Tenant;
  environment: Environment;
  session: Session;
  adapter: InternalAdapterInput;
  client: InternalToolCallClient;
  key: string;
  input: Record<string, any>;
};

let getConnectionIdentifier = (client: InternalToolCallClient) =>
  `metorial#${client.identifier}`;

let getSystemIdentifier = (d: Pick<CallInternalToolParams, 'session' | 'client'>) =>
  `int-tc:${d.session.id}:${d.client.identifier}:${new Date().toISOString().slice(0, 10)}`;

class internalToolCallServiceImpl {
  async call(d: CallInternalToolParams) {
    let solution = await getMetorialSolution();
    checkTenant({ ...d, solution }, d.session);
    await assertSessionInternalAdapter({ session: d.session, adapter: d.adapter });

    let manager = await SenderManager.create({
      sessionId: d.session.id,
      solutionId: solution.id,
      tenantId: d.tenant.id,
      transport: 'tool_call',
      adapter: d.adapter,
      connectionPrivateMetadata: {
        source: 'internal-tool-call',
        client: {
          identifier: d.client.identifier,
          privateMetadata: d.client.privateMetadata
        }
      }
    });

    let connection = await this.getOrCreateConnection({ manager, ...d });
    await manager.setConnection(connection);

    let result = await manager.callTool({
      toolId: d.key,
      input: { type: 'tool.call', data: d.input },
      waitForResponse: true,
      transport: 'tool_call'
    });

    return {
      result: {
        status: result.status === 'succeeded' ? 'success' : 'failure',
        output: result.output
          ? await messageOutputToToolCall(result.output, result.message)
          : null
      },
      message: result.message,
      connection
    };
  }

  private async getOrCreateConnection(d: CallInternalToolParams & { manager: SenderManager }) {
    let existing = await this.findConnection(d);
    if (existing) return existing;

    return await connectionInitLock.usingLock(
      `${d.session.id}:${d.client.identifier}`,
      async () => {
        let current = await this.findConnection(d);
        if (current) return current;

        return await d.manager.initialize({
          client: {
            identifier: getConnectionIdentifier(d.client),
            name: d.client.name,
            privateMetadata: d.client.privateMetadata
          },
          systemIdentifier: getSystemIdentifier(d),
          mcpTransport: 'none',
          isManualConnection: true
        });
      }
    );
  }

  private async findConnection(d: CallInternalToolParams) {
    return await db.sessionConnection.findFirst({
      where: {
        systemIdentifier: getSystemIdentifier(d),
        state: 'connected',
        status: 'active'
      },
      include: { participant: true }
    });
  }
}

export let internalToolCallService = Service.create(
  'internalToolCallService',
  () => new internalToolCallServiceImpl()
).build();
