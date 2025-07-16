import { db, ID, ServerSession } from '@metorial/db';
import { getSentry } from '@metorial/sentry';
import { getOriginalIdIfNeeded } from '@metorial/unified-id';
import { EngineMcpMessage } from '../mcp/message';

let Sentry = getSentry();

export let createSessionMessage = async (d: {
  message: EngineMcpMessage;
  serverSession: ServerSession;
}) => {
  let msg = d.message;
  let message = await db.sessionMessage.create({
    data: {
      id: ID.normalizeUUID('sessionMessage', msg.uuid),
      type: msg.type,
      method: msg.method,
      senderType: msg.sender.type,
      senderId: msg.sender.id,
      engineMessageId: msg.uuid,
      serverSessionOid: d.serverSession.oid,
      sessionOid: d.serverSession.sessionOid,
      originalId: getOriginalIdIfNeeded(msg.originalId),
      unifiedId: msg.unifiedId,
      payload: msg.message
    }
  });

  (async () => {
    await db.serverSession.update({
      where: { oid: d.serverSession.oid },
      data:
        msg.sender.type == 'server'
          ? { totalProductiveServerMessageCount: { increment: 1 } }
          : { totalProductiveClientMessageCount: { increment: 1 } }
    });

    await db.session.updateMany({
      where: { oid: d.serverSession.sessionOid },
      data:
        msg.sender.type == 'server'
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
