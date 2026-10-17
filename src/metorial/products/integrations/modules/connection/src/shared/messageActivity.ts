import { db } from '@metorial-subspace/db';

let PROTOGUARD_SKIPPED_METHODS = new Set([
  'initialize',
  'ping',
  'tools/list',
  'prompts/list',
  'resources/list',
  'resources/templates/list'
]);

type MessageActivityTarget = {
  sessionOid: bigint;
  connectionOid: bigint | null;
  sessionProviderOid: bigint | null;
};

export let getCreationIncrements = (message: { isProductive: boolean; source: string }) => ({
  client: message.isProductive && message.source === 'client' ? 1 : 0,
  provider: message.isProductive && message.source === 'provider' ? 1 : 0
});

export let claimMessageActivity = async (messageOid: bigint) => {
  let claimed = await db.sessionMessage.updateMany({
    where: { oid: messageOid, activityCountedAt: null },
    data: { activityCountedAt: new Date() }
  });

  return claimed.count > 0;
};

export let applyMessageActivity = async (
  message: MessageActivityTarget,
  d: { touch: boolean; client: number; provider: number }
) => {
  if (!d.touch && !d.client && !d.provider) return;

  let now = new Date();

  let increments = {
    totalProductiveClientMessageCount: d.client ? { increment: d.client } : undefined,
    totalProductiveProviderMessageCount: d.provider ? { increment: d.provider } : undefined
  };
  let activity = d.touch ? { lastActiveAt: now, lastMessageAt: now } : {};

  await Promise.all([
    message.connectionOid
      ? db.sessionConnection.updateMany({
          where: { oid: message.connectionOid },
          data: { ...activity, ...increments }
        })
      : undefined,

    message.sessionProviderOid
      ? db.sessionProvider.updateMany({
          where: { oid: message.sessionProviderOid },
          data: { ...(d.touch ? { lastMessageAt: now } : {}), ...increments }
        })
      : undefined,

    db.session.updateMany({
      where: { oid: message.sessionOid },
      data: { ...activity, ...increments }
    })
  ]);
};

export let shouldEvaluateProtoGuard = (message: {
  retentionLevel: string;
  type: string;
  methodOrToolKey: string | null;
}) => {
  if (message.retentionLevel !== 'full') return false;
  if (message.type !== 'mcp_control' || !message.methodOrToolKey) return true;

  return (
    !PROTOGUARD_SKIPPED_METHODS.has(message.methodOrToolKey) &&
    !message.methodOrToolKey.startsWith('notifications/')
  );
};
