import { db, ID, Instance, Organization, ServerSession } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { getSentry } from '@metorial/sentry';
import { getOriginalIdIfNeeded } from '@metorial/unified-id';
import { EngineMcpMessage } from '../mcp/message';

let Sentry = getSentry();

export let createSessionMessage = async (d: {
  message: EngineMcpMessage;
  serverSession: ServerSession;
  instance: Instance & { organization: Organization };
}) => {
  let msg = d.message;

  await Fabric.fire('session.session_message.created:before', {
    organization: d.instance.organization,
    instance: d.instance,
    session: d.serverSession,
    participant: { type: msg.sender.type }
  });

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
    await Fabric.fire('session.session_message.created.many:after', {
      organization: d.instance.organization,
      instance: d.instance,
      session: d.serverSession,
      sessionMessages: [message]
    });

    await db.serverSession.update({
      where: { oid: d.serverSession.oid },
      data:
        msg.sender.type == 'server'
          ? {
              totalProductiveServerMessageCount: { increment: 1 },
              lastServerActionAt: new Date()
            }
          : {
              totalProductiveClientMessageCount: { increment: 1 },
              lastClientActionAt: new Date()
            }
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
