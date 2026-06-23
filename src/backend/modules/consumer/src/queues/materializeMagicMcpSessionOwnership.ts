import { db } from '@metorial/db';
import { createQueue, QueueRetryError } from '@metorial/queue';
import { consumerIntegrationService } from '../services';

type MaterializeMagicMcpSessionOwnershipInput = {
  consumerProfileOid: string;
  magicMcpSessionOid: string;
  magicMcpTokenId?: string | null;
  magicMcpTarget:
    | {
        type: 'server';
        magicMcpServerId: string;
      }
    | {
        type: 'endpoint';
        magicMcpEndpointId: string;
      };
};

let toBigInt = (value: string) => BigInt(value);

export let materializeMagicMcpSessionOwnershipQueue =
  createQueue<MaterializeMagicMcpSessionOwnershipInput>({
    name: 'cons/magic/sessionOwn'
  });

export let enqueueMaterializeMagicMcpSessionOwnership = async (
  data: MaterializeMagicMcpSessionOwnershipInput
) =>
  await materializeMagicMcpSessionOwnershipQueue.add(data, {
    id: `${data.consumerProfileOid}:${data.magicMcpSessionOid}`
  });

export let materializeMagicMcpSessionOwnershipQueueProcessor =
  materializeMagicMcpSessionOwnershipQueue.process(async data => {
    let [consumerProfile, magicMcpSession, magicMcpToken] = await Promise.all([
      db.consumerProfile.findUnique({
        where: { oid: toBigInt(data.consumerProfileOid) }
      }),
      db.magicMcpSession.findUnique({
        where: { oid: toBigInt(data.magicMcpSessionOid) }
      }),
      data.magicMcpTokenId
        ? db.magicMcpToken.findUnique({
            where: { id: data.magicMcpTokenId },
            select: { oid: true }
          })
        : null
    ]);

    if (!consumerProfile || !magicMcpSession) throw new QueueRetryError();
    if (magicMcpSession.isConsumerReconciled) return;

    if (data.magicMcpTarget.type === 'server') {
      let magicMcpServer = await db.magicMcpServer.findUnique({
        where: { id: data.magicMcpTarget.magicMcpServerId },
        select: {
          oid: true,
          instanceOid: true
        }
      });
      if (!magicMcpServer) throw new QueueRetryError();

      await consumerIntegrationService.materializeMagicMcpSessionOwnership({
        consumerProfile,
        magicMcpTarget: {
          type: 'server',
          target: magicMcpServer
        },
        magicMcpSession
      });

      await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
        magicMcpToken,
        magicMcpServer,
        magicMcpSession
      });
      return;
    }

    let magicMcpEndpoint = await db.magicMcpEndpoint.findUnique({
      where: { id: data.magicMcpTarget.magicMcpEndpointId },
      select: {
        oid: true,
        instanceOid: true,
        consumerProfileOid: true,
        servers: {
          select: {
            magicMcpServerOid: true,
            magicMcpServer: {
              select: {
                oid: true,
                instanceOid: true
              }
            }
          }
        }
      }
    });
    if (!magicMcpEndpoint) throw new QueueRetryError();

    await consumerIntegrationService.materializeMagicMcpSessionOwnership({
      consumerProfile,
      magicMcpTarget: {
        type: 'endpoint',
        target: magicMcpEndpoint
      },
      magicMcpSession
    });

    await consumerIntegrationService.markMagicMcpResourcesConsumerReconciled({
      magicMcpToken,
      magicMcpEndpoint,
      magicMcpServers: magicMcpEndpoint.servers.map(server => server.magicMcpServer),
      magicMcpSession
    });
  });
