import { db, ID, SessionMessageType, type ServerSession } from '@metorial/db';
import { createLock } from '@metorial/lock';
import { getMessageType, type JSONRPCMessage } from '@metorial/mcp-utils';
import { getSentry } from '@metorial/sentry';
import type { Participant } from '../../types';
import { UnifiedID } from '../unifiedId';
import { BrokerBusBackend } from './backend';

let Sentry = getSentry();

let lock = createLock({
  name: 'mtg/op/bus'
});

export class BrokerBus {
  #unifiedId: UnifiedID;

  private constructor(
    private backend: BrokerBusBackend,
    private participant: Participant,
    private session: ServerSession,
    opts: { subscribe: boolean }
  ) {
    if (this.connector == 'server') {
      this.backend.emit('server_open');
    }

    this.#unifiedId = new UnifiedID(this.session.id);
  }

  static async create(
    participant: Participant,
    session: ServerSession,
    opts: { subscribe: boolean }
  ) {
    let backend = await BrokerBusBackend.create(session, opts);
    return new BrokerBus(backend, participant, session, opts);
  }

  private get connector() {
    return this.participant.type;
  }

  private get opponent() {
    return this.connector == 'server' ? 'client' : 'server';
  }

  #closing = false;
  async close() {
    if (this.#closing) return;
    this.#closing = true;

    if (this.connector == 'server') {
      this.backend.emit('server_close');
    } else {
      this.backend.emit('client_close');
    }

    this.backend.close();
  }

  #stopping = false;
  async stop() {
    if (this.#stopping) return;
    this.#stopping = true;

    await this.backend.emit('stop');
    await this.close();
  }

  async sendMessage(message: JSONRPCMessage | JSONRPCMessage[]) {
    let messages = Array.isArray(message) ? message : [message];
    if (!messages.length) return [];

    return (
      (await lock
        .usingLock(this.session.id, async () => {
          let createdMessages = await db.sessionMessage.createManyAndReturn({
            data: messages.map(message => ({
              id: ID.generateIdSync('sessionMessage'),
              type: getMessageType(message),
              method: 'method' in message ? message.method : null,
              senderType: this.connector,
              senderId: this.participant.id,
              serverSessionOid: this.session.oid,
              sessionOid: this.session.sessionOid,
              originalId: 'id' in message ? message.id : null,
              unifiedId:
                'id' in message
                  ? String(
                      this.#unifiedId.serialize({
                        sender: this.participant,
                        originalId: message.id
                      })
                    )
                  : null,
              payload: message
            }))
          });

          (async () => {
            await db.serverSession.updateMany({
              where: { oid: this.session.oid },
              data:
                this.connector == 'server'
                  ? {
                      lastServerActionAt: new Date(),
                      totalProductiveServerMessageCount: { increment: messages.length }
                    }
                  : {
                      lastClientActionAt: new Date(),
                      totalProductiveClientMessageCount: { increment: messages.length }
                    }
            });

            await db.session.updateMany({
              where: { oid: this.session.sessionOid },
              data:
                this.connector == 'server'
                  ? {
                      totalProductiveServerMessageCount: { increment: messages.length }
                    }
                  : {
                      totalProductiveClientMessageCount: { increment: messages.length },
                      lastClientActionAt: new Date(),
                      lastClientPingAt: new Date()
                    }
            });
          })().catch(e => {
            Sentry.captureException(e);
            console.error('Error sending message', e);
          });

          this.backend.emit(`${this.connector}_mcp_message`);

          return createdMessages;
        })
        .catch(e => {
          console.error('Error sending message', e);
        })) ?? []
    );
  }

  sendServerError(error: { message: string; [key: string]: any }) {
    db.sessionMessage
      .createMany({
        data: {
          id: ID.generateIdSync('sessionMessage'),
          type: 'server_error',
          senderType: this.connector,
          senderId: this.participant.id,
          serverSessionOid: this.session.oid,
          sessionOid: this.session.sessionOid,
          payload: {
            jsonrpc: '2.0',
            method: 'server_error',
            params: error
          }
        }
      })
      .catch(e => {});

    this.backend.emit('server_error', error);
  }

  async pullMessages(opts: {
    type: SessionMessageType[];
    afterId?: string;
    ids?: string[];
    includeHandled?: boolean;
  }) {
    return lock.usingLock(this.session.id, async () => {
      let messages = await db.sessionMessage.updateManyAndReturn({
        where: {
          AND: [
            {
              type: { in: opts.type },
              senderType: this.opponent,
              serverSessionOid: this.session.oid,
              isHandled: opts.includeHandled ? undefined : false
            },

            ...(opts.afterId
              ? [
                  {
                    OR: [{ id: { gt: opts.afterId } }, { unifiedId: { gt: opts.afterId } }]
                  }
                ]
              : []),

            ...(opts.ids
              ? [
                  {
                    OR: [{ id: { in: opts.ids } }, { unifiedId: { in: opts.ids } }]
                  }
                ]
              : [])
          ]
        },
        data: {
          isHandled: true
        },
        limit: 1000
      });

      return messages.sort((a, b) => a.id.localeCompare(b.id));
    });
  }

  onMessage(callback: () => void) {
    return this.backend.on(`${this.opponent}_mcp_message`, async () => {
      await callback();
    });
  }

  onClose(callback: () => void) {
    return this.backend.on(`${this.opponent}_close`, async () => {
      await callback();
    });
  }

  onStop(callback: () => void) {
    return this.backend.on('stop', async () => {
      await callback();
    });
  }

  onServerError(callback: (error: { message: string; [key: string]: any }) => void) {
    return this.backend.on('server_error', async error => {
      await callback(error);
    });
  }
}
