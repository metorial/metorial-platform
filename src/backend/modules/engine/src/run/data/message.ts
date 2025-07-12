import { db, ID, ServerSession } from '@metorial/db';
import { getSentry } from '@metorial/sentry';
import { UnifiedID } from '@metorial/unified-id';
import { EngineMcpMessage } from '../mcp/message';

let Sentry = getSentry();

export let createSessionMessage = async (d: {
  message: EngineMcpMessage;
  serverSession: ServerSession;
  unifiedId: UnifiedID;
}) => {
  let msg = d.message;
  let message = await db.sessionMessage.create({
    data: {
      id: ID.normalizeUUID('sessionMessage', msg.uuid),
      type: msg.type,
      method: msg.method,
      senderType: msg.from.type,
      senderId: msg.from.id,
      engineMessageId: msg.uuid,
      serverSessionOid: d.serverSession.oid,
      sessionOid: d.serverSession.sessionOid,
      originalId: msg.id,
      unifiedId:
        msg.id !== undefined
          ? String(
              d.unifiedId.serialize({
                sender: msg.from,
                originalId: msg.id
              })
            )
          : null,
      payload: msg.message
    }
  });

  (async () => {
    await db.serverSession.update({
      where: { oid: d.serverSession.oid },
      data:
        msg.from.type == 'server'
          ? { totalProductiveServerMessageCount: { increment: 1 } }
          : { totalProductiveClientMessageCount: { increment: 1 } }
    });

    await db.session.updateMany({
      where: { oid: d.serverSession.sessionOid },
      data:
        msg.from.type == 'server'
          ? {
              totalProductiveServerMessageCount: { increment: 1 }
            }
          : {
              totalProductiveClientMessageCount: { increment: 1 },
              lastClientActionAt: new Date(),
              lastClientPingAt: new Date(),
              connectionStatus: 'connected'
            }
    });
  })().catch(err => Sentry.captureException(err));
};
