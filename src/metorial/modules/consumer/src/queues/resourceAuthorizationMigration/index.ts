import { db } from '@metorial/db';
import { createQueue } from '@metorial/queue';
import { randomUUID } from 'node:crypto';
import {
  completeMigrationPhase,
  migrationPhases,
  RESOURCE_AUTHORIZATION_MIGRATION_RUN_ID,
  serializeMigrationError,
  startMigrationPhase,
  type ResourceAuthorizationMigrationPhase
} from './artifacts';
import { inventoryLegacyAccess } from './inventory';
import { reconcileCanonicalAccess } from './reconcileAccess';
import { reconcileLegacyConsumerActors } from './reconcileActors';
import {
  finalizeResourceAuthorizationMigration,
  shadowCompareCanonicalAccess
} from './shadowCompare';

type ResourceAuthorizationMigrationInput = {
  runId: string;
  attempt: number;
};

export let resourceAuthorizationMigrationQueue =
  createQueue<ResourceAuthorizationMigrationInput>({
    name: 'cons/resourceAuth/reconcile',
    jobOpts: {
      // The retry horizon must exceed the ten-minute database lease so a
      // worker killed after acquiring it can be recovered by this same job.
      attempts: 8,
      backoff: { type: 'exponential', delay: 60_000 }
    }
  });

export let enqueueResourceAuthorizationMigration = async (
  runId = RESOURCE_AUTHORIZATION_MIGRATION_RUN_ID
) => {
  let run = await db.$transaction(async tx => {
    let existing = await tx.resourceAuthorizationMigrationRun.findUnique({
      where: { runId }
    });
    if (existing?.status == 'completed') {
      throw new Error(`Resource authorization migration ${runId} already completed.`);
    }
    if (existing?.status == 'running' || existing?.status == 'pending') {
      return existing;
    }
    return await tx.resourceAuthorizationMigrationRun.upsert({
      where: { runId },
      update: {
        status: 'pending',
        attempt: { increment: 1 },
        failedAt: null,
        failure: undefined
      },
      create: {
        runId,
        status: 'pending',
        attempt: 1
      }
    });
  });

  await resourceAuthorizationMigrationQueue.add(
    { runId, attempt: run.attempt },
    { id: `${runId}:${run.attempt}` }
  );
  return run;
};

let executePhase = async (
  runId: string,
  phase: ResourceAuthorizationMigrationPhase,
  fence: () => Promise<void>
) => {
  if (phase == 'inventory_pre_actor') {
    return await inventoryLegacyAccess({ runId, stage: 'pre_actor' });
  }
  if (phase == 'reconcile_actors') {
    return await reconcileLegacyConsumerActors({ runId, fence });
  }
  if (phase == 'inventory_post_actor') {
    return await inventoryLegacyAccess({ runId, stage: 'post_actor' });
  }
  if (phase == 'reconcile_access') {
    return await reconcileCanonicalAccess({ runId, fence });
  }
  if (phase == 'shadow_compare') {
    return await shadowCompareCanonicalAccess({ runId });
  }
  return await finalizeResourceAuthorizationMigration({ runId });
};

export let resourceAuthorizationMigrationQueueProcessor =
  resourceAuthorizationMigrationQueue.process(async data => {
    let leaseOwner = `${data.attempt}:${randomUUID()}`;
    let leaseExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    let acquired = await db.resourceAuthorizationMigrationRun.updateMany({
      where: {
        runId: data.runId,
        attempt: data.attempt,
        OR: [
          { status: 'pending' },
          { status: 'failed' },
          {
            status: 'running',
            leaseExpiresAt: { lt: new Date() }
          }
        ]
      },
      data: {
        status: 'running',
        startedAt: new Date(),
        leaseOwner,
        leaseExpiresAt,
        failedAt: null,
        failure: undefined
      }
    });
    if (acquired.count == 0) {
      let run = await db.resourceAuthorizationMigrationRun.findUnique({
        where: { runId: data.runId }
      });
      if (run?.status == 'completed') {
        throw new Error(
          `Refusing to rerun completed resource authorization migration ${data.runId}.`
        );
      }
      throw new Error(
        `Resource authorization migration ${data.runId} is held by an active worker lease.`
      );
    }

    let heartbeat = setInterval(() => {
      void db.resourceAuthorizationMigrationRun.updateMany({
        where: { runId: data.runId, leaseOwner, status: 'running' },
        data: { leaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }
      });
    }, 30_000);
    let fenceLease = async () => {
      let fenced = await db.resourceAuthorizationMigrationRun.updateMany({
        where: {
          runId: data.runId,
          attempt: data.attempt,
          leaseOwner,
          status: 'running',
          leaseExpiresAt: { gt: new Date() }
        },
        data: { leaseExpiresAt: new Date(Date.now() + 10 * 60 * 1000) }
      });
      if (fenced.count != 1) {
        throw new Error(`Lost resource authorization migration lease ${leaseOwner}.`);
      }
    };

    try {
      for (let phase of migrationPhases) {
        await fenceLease();
        let shouldRun = await startMigrationPhase(data.runId, phase);
        if (!shouldRun) continue;
        try {
          let details = await executePhase(data.runId, phase, fenceLease);
          await fenceLease();
          await completeMigrationPhase(data.runId, phase, details);
        } catch (error) {
          let failure = serializeMigrationError(error);
          await db.$transaction(async tx => {
            let fencedFailure = await tx.resourceAuthorizationMigrationRun.updateMany({
              where: {
                runId: data.runId,
                attempt: data.attempt,
                leaseOwner,
                status: 'running'
              },
              data: {
                status: 'failed',
                failedAt: new Date(),
                leaseOwner: null,
                leaseExpiresAt: null,
                failure
              }
            });
            if (fencedFailure.count == 1) {
              await tx.resourceAuthorizationMigrationPhase.updateMany({
                where: {
                  runId: data.runId,
                  phase,
                  status: 'running'
                },
                data: {
                  status: 'failed',
                  failedAt: new Date(),
                  failure
                }
              });
            }
          });
          throw error;
        }
      }

      await fenceLease();
      let completed = await db.resourceAuthorizationMigrationRun.updateMany({
        where: {
          runId: data.runId,
          attempt: data.attempt,
          leaseOwner,
          status: 'running'
        },
        data: {
          status: 'completed',
          currentPhase: 'finalize',
          leaseOwner: null,
          leaseExpiresAt: null,
          completedAt: new Date()
        }
      });
      if (completed.count != 1) {
        throw new Error(`Lost resource authorization migration lease ${leaseOwner}.`);
      }
    } finally {
      clearInterval(heartbeat);
    }
  });

// setTimeout(() => {
//   enqueueResourceAuthorizationMigration();
// });
