import { badRequestError, ServiceError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import type { BroadcastMessage, ConduitResult } from '@metorial-subspace/connection-utils';
import { db, type SessionMessage } from '@metorial-subspace/db';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import type { CreateMessageProps } from '../shared/createMessage';
import {
  type CallToolProps,
  type InitProps,
  SenderManager,
  type SenderMangerProps
} from './manager';

export class SenderConnection {
  private constructor(private readonly manager: SenderManager) {}

  static async create(d: SenderMangerProps): Promise<SenderConnection> {
    return new SenderConnection(await SenderManager.create(d));
  }

  get connection() {
    return this.manager.connection;
  }

  get session() {
    return this.manager.session;
  }

  listener(d?: { replayFromMessageId?: string }) {
    if (!this.manager.connection) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create listener without an active connection'
        })
      );
    }

    let sub = broadcastNats.subscribe(
      topics.sessionConnection.encode({
        session: this.manager.session,
        connection: this.manager.connection
      })
    );

    return {
      close: () => sub.unsubscribe(),

      async *[Symbol.asyncIterator]() {
        if (d?.replayFromMessageId) {
          let message = await db.sessionMessage.findUnique({
            where: { id: d.replayFromMessageId }
          });
          if (!message) {
            throw new ServiceError(
              badRequestError({
                message: 'Invalid last message ID for replay'
              })
            );
          }

          let cursor: string | undefined = d.replayFromMessageId;
          let count = 20;

          while (cursor) {
            let messages: SessionMessage[] = await db.sessionMessage.findMany({
              where: {
                id: { gt: cursor },
                status: { not: 'waiting_for_response' }
              },
              orderBy: { oid: 'asc' },
              take: count
            });

            for (let msg of messages) {
              yield {
                channel: 'targeted_response',
                status: msg.status,
                completedAt: message.completedAt,
                message: msg,
                output: message.output
              } satisfies ConduitResult & { channel: 'targeted_response' };
            }

            cursor = messages.length === count ? messages[messages.length - 1]?.id : undefined;
          }
        }

        for await (let msg of sub) {
          let data = serialize.decode(new TextDecoder().decode(msg.data)) as BroadcastMessage;

          yield {
            ...data.result,
            channel: data.channel
          };
        }
      }
    };
  }

  listToolsIncludingInternal() {
    return this.manager.listToolsIncludingInternal();
  }

  listToolsIncludingInternalAndNonAllowed() {
    return this.manager.listToolsIncludingInternalAndNonAllowed();
  }

  listTools() {
    return this.manager.listTools();
  }

  listProviders() {
    return this.manager.listProviders();
  }

  getToolById(d: { toolId: string }) {
    return this.manager.getToolById(d);
  }

  callTool(d: CallToolProps) {
    return this.manager.callTool(d);
  }

  initialize(d: InitProps) {
    return this.manager.initialize(d);
  }

  createConnection() {
    return this.manager.createConnection();
  }

  createMessage(d: CreateMessageProps) {
    return this.manager.createMessage(d);
  }

  disableConnection() {
    return this.manager.disableConnection();
  }
}
