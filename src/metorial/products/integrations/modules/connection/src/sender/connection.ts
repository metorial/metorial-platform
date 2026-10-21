import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { serialize } from '@lowerdeck/serialize';
import {
  type BroadcastMessage,
  type ConduitResult,
  getOffloadedSessionMessage
} from '@metorial-subspace/connection-utils';
import { db, type SessionMessage } from '@metorial-subspace/db';
import { broadcastNats } from '../lib/nats';
import { topics } from '../lib/topic';
import type { CreateMessageProps } from '../shared/createMessage';
import {
  type CallToolProps,
  type InitProps,
  SenderManager,
  type SenderMangerProps,
  type SessionlessConnectionProps
} from './manager';

let REPLAY_STORAGE_POLL_ATTEMPTS = 10;
let REPLAY_STORAGE_POLL_INTERVAL_MS = 500;
let REPLAY_STORAGE_POLL_MAX_MESSAGE_AGE_MS = 30_000;

// A body offloaded straight to storage may still be in flight, or may have been put back
// into the row after a failed write, so recent messages are polled for both.
let readReplayOutput = async (msg: SessionMessage) => {
  if (!msg.isOffloadedToStorage) return msg.output;

  let isRecent = Date.now() - msg.createdAt.getTime() < REPLAY_STORAGE_POLL_MAX_MESSAGE_AGE_MS;
  let attempts = isRecent ? REPLAY_STORAGE_POLL_ATTEMPTS : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    let offloaded = await getOffloadedSessionMessage(msg);
    if (offloaded) return offloaded.output;

    if (attempt === attempts) break;
    await delay(REPLAY_STORAGE_POLL_INTERVAL_MS);

    let current = await db.sessionMessage.findUnique({
      where: { oid: msg.oid },
      select: { isOffloadedToStorage: true, output: true }
    });
    if (current && !current.isOffloadedToStorage) return current.output;
  }

  return msg.output;
};

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

  get tenant() {
    return this.manager.tenant;
  }

  listener(d?: { replayFromMessageId?: string }) {
    if (!this.manager.connection) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot create listener without an active connection'
        })
      );
    }

    let connection = this.manager.connection;

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
            where: { id: d.replayFromMessageId },
            select: { oid: true, connectionOid: true }
          });
          if (!message || message.connectionOid !== connection.oid) {
            throw new ServiceError(
              badRequestError({
                message: 'Invalid last message ID for replay'
              })
            );
          }

          let cursor: bigint | undefined = message.oid;
          let count = 20;

          while (cursor) {
            let messages: SessionMessage[] = await db.sessionMessage.findMany({
              where: {
                connectionOid: connection.oid,
                oid: { gt: cursor },
                status: { not: 'waiting_for_response' }
              },
              orderBy: { oid: 'asc' },
              take: count
            });

            let outputs = await Promise.all(messages.map(readReplayOutput));

            for (let [index, msg] of messages.entries()) {
              let output = outputs[index] ?? null;

              yield {
                channel: 'targeted_response',
                status: msg.status,
                completedAt: msg.completedAt,
                message: { ...msg, output },
                output
              } satisfies ConduitResult & { channel: 'targeted_response' };
            }

            cursor =
              messages.length === count ? messages[messages.length - 1]?.oid : undefined;
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

  getInternalToolByProviderType(
    d: Parameters<SenderManager['getInternalToolByProviderType']>[0]
  ) {
    return this.manager.getInternalToolByProviderType(d);
  }

  getToolById(d: { toolId: string }) {
    return this.manager.getToolById(d);
  }

  shouldRedactStoredToolInput(toolId: string) {
    return this.manager.shouldRedactStoredToolInput(toolId);
  }

  callTool(d: CallToolProps) {
    return this.manager.callTool(d);
  }

  initialize(d: InitProps) {
    return this.manager.initialize(d);
  }

  resolveSessionlessConnection(d: SessionlessConnectionProps) {
    return this.manager.resolveSessionlessConnection(d);
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
