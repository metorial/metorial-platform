import { createLock } from '@lowerdeck/lock';
import { QueueRetryError } from '@lowerdeck/queue';
import { Prisma } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { snowflake } from '../../id';

export let triggerStateLeaseMs = 30 * 60 * 1000;

export let triggerInstanceLock = createLock({
  name: 'shub/trg/instance/lock',
  redisUrl: env.service.REDIS_URL
});

export let triggerStateInstanceInclude = {
  triggerGroup: true,
  triggerRegistration: {
    include: {
      tenant: true,
      slate: true,
      instance: true,
      instanceConfig: true,
      authConfig: { include: { authMethod: true, oauthCredentials: true } }
    }
  }
};

export type TriggerStateInstance = Prisma.TriggerRegistrationInstanceGetPayload<{
  include: typeof triggerStateInstanceInclude;
}>;

export let claimTriggerInstance = async (instanceId: string) => {
  let now = new Date();
  let token = snowflake.nextId().toString();
  return db.$transaction(async tx => {
    let claimed = await tx.triggerRegistrationInstance.updateMany({
      where: {
        id: instanceId,
        OR: [{ stateClaimUntil: null }, { stateClaimUntil: { lte: now } }],
        triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
      },
      data: {
        stateClaimToken: token,
        stateClaimUntil: new Date(now.getTime() + triggerStateLeaseMs)
      }
    });
    if (!claimed.count) return null;

    return tx.triggerRegistrationInstance.findFirst({
      where: { id: instanceId, stateClaimToken: token },
      include: triggerStateInstanceInclude
    });
  });
};

export let releaseTriggerInstance = (instance: TriggerStateInstance) =>
  db.triggerRegistrationInstance.updateMany({
    where: { oid: instance.oid, stateClaimToken: instance.stateClaimToken },
    data: { stateClaimToken: null, stateClaimUntil: null }
  });

export let commitTriggerInstance = async (
  instance: TriggerStateInstance,
  updatedState: Prisma.JsonValue | undefined,
  write: (tx: Prisma.TransactionClient) => Promise<void>
) =>
  db.$transaction(async tx => {
    // Hold the tenant row until commit so a concurrent callback-disable cannot
    // cross the state/event acceptance boundary.
    await tx.$queryRaw`SELECT "oid" FROM "Tenant" WHERE "oid" = ${instance.triggerRegistration.tenantOid} FOR SHARE`;
    await tx.$queryRaw`SELECT "oid" FROM "TriggerRegistration" WHERE "oid" = ${instance.triggerRegistrationOid} FOR SHARE`;
    let changed = await tx.triggerRegistrationInstance.updateMany({
      where: {
        oid: instance.oid,
        stateClaimToken: instance.stateClaimToken,
        stateClaimUntil: { gt: new Date() },
        triggerRegistration: { status: 'active', tenant: { disableCallbacks: false } }
      },
      data: {
        state:
          updatedState === undefined
            ? undefined
            : updatedState === null
              ? Prisma.DbNull
              : updatedState,
        stateClaimToken: null,
        stateClaimUntil: null
      }
    });
    if (!changed.count) throw new QueueRetryError();

    await write(tx);
  });
