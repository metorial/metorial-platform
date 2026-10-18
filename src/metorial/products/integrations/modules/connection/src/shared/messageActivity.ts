import { withTransaction } from '@metorial-subspace/db';

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

export let recordMessageActivity = async (
  message: MessageActivityTarget & { oid: bigint; activityCountedAt: Date | null } & {
    isProductive: boolean;
    source: string;
  },
  d: { response: { client: number; provider: number } }
) =>
  withTransaction(async db => {
    let claimed = message.activityCountedAt
      ? { count: 0 }
      : await db.sessionMessage.updateMany({
          where: { oid: message.oid, activityCountedAt: null },
          data: { activityCountedAt: new Date() }
        });
    let countCreation = claimed.count > 0;

    let creation = countCreation ? getCreationIncrements(message) : { client: 0, provider: 0 };
    let client = creation.client + d.response.client;
    let provider = creation.provider + d.response.provider;
    if (!countCreation && !client && !provider) return countCreation;

    let now = new Date();

    let increments = {
      totalProductiveClientMessageCount: client ? { increment: client } : undefined,
      totalProductiveProviderMessageCount: provider ? { increment: provider } : undefined
    };
    let activity = countCreation ? { lastActiveAt: now, lastMessageAt: now } : {};

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
            data: { ...(countCreation ? { lastMessageAt: now } : {}), ...increments }
          })
        : undefined,

      db.session.updateMany({
        where: { oid: message.sessionOid },
        data: { ...activity, ...increments }
      })
    ]);

    return countCreation;
  });

export let shouldEvaluateProtoGuard = (message: {
  retentionLevel: string;
  methodOrToolKey: string | null;
  toolCall: unknown;
}) => {
  if (message.retentionLevel !== 'full') return false;
  if (message.toolCall || !message.methodOrToolKey) return true;

  return (
    !PROTOGUARD_SKIPPED_METHODS.has(message.methodOrToolKey) &&
    !message.methodOrToolKey.startsWith('notifications/')
  );
};
