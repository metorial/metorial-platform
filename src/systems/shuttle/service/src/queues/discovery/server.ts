import { canonicalize } from '@lowerdeck/canonicalize';
import { delay } from '@lowerdeck/delay';
import { Hash } from '@lowerdeck/hash';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { getSentry } from '@lowerdeck/sentry';
import { McpError } from '@modelcontextprotocol/sdk/types.js';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { EmbeddedConnection, EmbeddedConnectionError } from '../../mcp/connection/embedded';
import { autoPaginateMcp } from '../../mcp/utils/paginate';
import { serverConnectionService } from '../../services';

let Sentry = getSentry();

let checkInnerError = (e: any): PrismaJson.ServerDiscoveryWarning | undefined => {
  if (typeof e.name == 'string' && e.name == '$ZodError') {
    return {
      code: 'invalid_response',
      message: 'Invalid response from server during discovery',
      data: { error: e.issues ?? e.errors }
    };
  }
  if (
    typeof e.message == 'string' &&
    (e.message.includes('MCP error -32601') || e.message.includes('method does not exist'))
  ) {
    return {
      code: 'invalid_response',
      message: `Server does not support required MCP methods for discovery: ${e.message}`
    };
  }

  throw e;
};

let passWarning = (
  warnings: PrismaJson.ServerDiscoveryWarning[],
  warning: PrismaJson.ServerDiscoveryWarning | undefined
) => {
  if (!warning) return;
  warnings.push(warning);
};

let doWithCheck = async <T>(
  warnings: PrismaJson.ServerDiscoveryWarning[],
  fn: () => Promise<T>
) => {
  try {
    await fn();
  } catch (e) {
    console.warn('Warning during server discovery:', e);
    let warning = checkInnerError(e);
    console.warn('Warning during server discovery:', warning);
    passWarning(warnings, warning);
  }
};

class TimeoutError extends Error {}

export let discoverServerQueue = createQueue<{
  serverDiscoveryId: string;
  _remote?: {
    isAutoSwitched: boolean;
  };
}>({
  name: 'shut/server/discover',
  redisUrl: env.service.REDIS_URL
});

export let discoverServerQueueProcessor = discoverServerQueue.process(async data => {
  let discovery = await db.serverDiscovery.findFirst({
    where: { id: data.serverDiscoveryId },
    include: {
      tenant: true,
      serverConfig: true,
      serverAuthConfig: true,
      serverVersion: { include: { server: true } }
    }
  });
  if (!discovery) throw new QueueRetryError();

  let connection = await serverConnectionService.createServerConnection({
    tenant: discovery.tenant,
    input: {
      serverConfig: discovery.serverConfig,
      serverVersion: discovery.serverVersion,
      serverAuthConfig: discovery.serverAuthConfig || undefined,

      client: { name: 'Metorial Discovery', version: '1.0.0' },
      capabilities: {},

      enclaveId: undefined,
      egressPolicy: undefined
    }
  });

  let state: {
    client: EmbeddedConnection | undefined;
    specValue: PrismaJson.ServerSpecificationValue | undefined;
    warnings: PrismaJson.ServerDiscoveryWarning[];
    step: string;
  } = {
    client: undefined,
    specValue: undefined,
    warnings: [],
    step: 'connecting'
  };

  let timeout = discovery.serverVersion.server.type == 'container' ? 2 * 60 * 1000 : 30 * 1000;

  try {
    await Promise.race([
      delay(timeout).then(() => {
        throw new TimeoutError();
      }),
      (async () => {
        state.client = await EmbeddedConnection.create(connection);

        let capabilities = await state.client.getServerCapabilities();
        let version = await state.client.getServerVersion();
        let instructions = await state.client.getInstructions();

        state.specValue = {
          capabilities: capabilities ?? {},
          info: version ?? { name: 'unknown', version: '0.0.0' },
          instructions,
          prompts: [],
          tools: [],
          resourceTemplates: []
        };

        state.step = 'discovery:prompts';

        await doWithCheck(state.warnings, async () => {
          let promptsRaw = capabilities?.prompts
            ? await autoPaginateMcp(cursor => state.client!.listPrompts({ cursor }))
            : [];
          state.specValue!.prompts = promptsRaw.flatMap(p => p.prompts);
        });

        state.step = 'discovery:tools';

        await doWithCheck(state.warnings, async () => {
          let toolsRaw = capabilities?.tools
            ? await autoPaginateMcp(cursor => state.client!.listTools({ cursor }))
            : [];
          state.specValue!.tools = toolsRaw.flatMap(t => t.tools);
        });

        state.step = 'discovery:resource_templates';

        await doWithCheck(state.warnings, async () => {
          let resourceTemplatesRaw = capabilities?.resources
            ? await autoPaginateMcp(cursor => state.client!.listResourceTemplates({ cursor }))
            : [];
          state.specValue!.resourceTemplates = resourceTemplatesRaw.flatMap(
            t => t.resourceTemplates
          );
        });

        let hash = await Hash.sha256(canonicalize(state.specValue));
        let spec = await db.serverSpecification.upsert({
          where: {
            serverOid_hash: {
              serverOid: discovery.serverVersion.serverOid,
              hash
            }
          },
          create: {
            ...getId('serverSpecification'),
            serverOid: discovery.serverVersion.serverOid,
            hash,
            value: state.specValue
          },
          update: {}
        });

        let res = await db.serverDiscovery.update({
          where: { oid: discovery.oid },
          data: {
            status: 'succeeded',
            specificationOid: spec.oid,
            connectionOid: connection.oid,
            warnings: state.warnings
          }
        });

        if (data._remote?.isAutoSwitched) {
          await db.serverVersion.update({
            where: { oid: discovery.serverVersion.oid },
            data: {
              remoteProtocolAutoSwitchStatus: 'succeeded'
            }
          });
        }
      })()
    ]);
  } catch (e) {
    console.error('Error during server discovery:', e);

    let error: PrismaJson.ServerDiscoveryError = null;
    let sendToSentry = true;

    if (e instanceof McpError) {
      sendToSentry = false;
      error = {
        type: 'mcp_error',
        error: {
          code: e.code,
          message: e.message,
          data: {
            ...(typeof e.data === 'object' && e.data ? e.data : { data: e.data }),
            _metorial: {
              step: state.step,
              info: state.specValue?.info
            }
          }
        }
      };
    } else if (e instanceof TimeoutError) {
      sendToSentry = false;
      error = {
        type: 'timeout_error',
        message: `Server discovery timed out after ${Math.round(timeout / 1000)} seconds`
      };
    } else if (e instanceof EmbeddedConnectionError) {
      sendToSentry = false;
      error = {
        type: 'connection_error',
        error: {
          code: e.code,
          message: e.message
        }
      };
    } else {
      error = {
        type: 'connection_error',
        error: {
          code: 'discovery_failed',
          message: e instanceof Error ? e.message : 'Unknown error'
        }
      };
    }

    if (sendToSentry) Sentry.captureException(e);

    if (data._remote?.isAutoSwitched) {
      // Auto switch didn't work - let's roll back to the original protocol and mark auto switch as failed to avoid infinite loop
      await db.serverVersion.update({
        where: { oid: discovery.serverVersion.oid },
        data: {
          remoteProtocolAutoSwitchStatus: 'failed',
          remoteProtocol: discovery.serverVersion.originalRemoteProtocol,
          originalRemoteProtocol: null
        }
      });
    } else if (
      discovery.serverVersion.server.type == 'remote' &&
      discovery.serverVersion.remoteProtocolAutoSwitchStatus != 'succeeded' &&
      discovery.serverVersion.remoteProtocolAutoSwitchStatus != 'failed'
    ) {
      await db.serverVersion.update({
        where: { oid: discovery.serverVersion.oid },
        data: {
          remoteProtocolAutoSwitchStatus: 'attempting',
          originalRemoteProtocol: discovery.serverVersion.remoteProtocol,
          remoteProtocol:
            discovery.serverVersion.remoteProtocol == 'sse' ? 'streamable_http' : 'sse'
        }
      });

      await discoverServerQueue.add({
        serverDiscoveryId: discovery.id,
        _remote: { isAutoSwitched: true }
      });

      // Don't mark the discovery as failed yet - we'll wait for the auto switch attempt
      // to complete and then mark as failed if it doesn't succeed
      return;
    }

    console.error('Final error object for server discovery failure:', error);

    let res = await db.serverDiscovery.update({
      where: { oid: discovery.oid },
      data: {
        status: 'failed',
        connectionOid: connection.oid,
        warnings: state.warnings,
        error
      }
    });
  } finally {
    try {
      if (state.client) await state.client.terminate();
    } catch (e) {
      Sentry.captureException(e);
      console.error('Error terminating client during server discovery:', e);
    }
  }
});
