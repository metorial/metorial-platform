import { db, type Prisma } from '@metorial/db';

export let RESOURCE_AUTHORIZATION_MIGRATION_RUN_ID = 'resource_authorization_v1';

export let migrationPhases = [
  'inventory_pre_actor',
  'reconcile_actors',
  'inventory_post_actor',
  'reconcile_access',
  'shadow_compare',
  'finalize'
] as const;

export type ResourceAuthorizationMigrationPhase = (typeof migrationPhases)[number];

export let migrationJsonValue = (value: unknown): Prisma.InputJsonValue =>
  JSON.parse(
    JSON.stringify(value, (_, item) => (typeof item == 'bigint' ? item.toString() : item))
  ) as Prisma.InputJsonValue;

export let serializeMigrationError = (error: unknown) =>
  migrationJsonValue({
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  });

export let recordMigrationArtifact = async (d: {
  runId: string;
  stage: string;
  kind: string;
  recordKey: string;
  classification: string;
  payload: unknown;
}) =>
  await db.resourceAuthorizationMigrationArtifact.upsert({
    where: {
      runId_stage_kind_recordKey: {
        runId: d.runId,
        stage: d.stage,
        kind: d.kind,
        recordKey: d.recordKey
      }
    },
    // The immutable baseline is written through replaceMigrationArtifacts.
    // Operational decisions/issues use this helper so a repaired retry can
    // refresh its classification and evidence.
    update: {
      classification: d.classification,
      payload: migrationJsonValue(d.payload)
    },
    create: {
      runId: d.runId,
      stage: d.stage,
      kind: d.kind,
      recordKey: d.recordKey,
      classification: d.classification,
      payload: migrationJsonValue(d.payload)
    }
  });

export let startMigrationPhase = async (runId: string, phase: string) => {
  let existing = await db.resourceAuthorizationMigrationPhase.findUnique({
    where: { runId_phase: { runId, phase } }
  });
  if (existing?.status == 'completed') return false;
  let phaseIndex = migrationPhases.indexOf(phase as ResourceAuthorizationMigrationPhase);
  let predecessor = phaseIndex > 0 ? migrationPhases[phaseIndex - 1] : null;
  if (predecessor) {
    let prior = await db.resourceAuthorizationMigrationPhase.findUnique({
      where: { runId_phase: { runId, phase: predecessor } }
    });
    if (prior?.status != 'completed' || !prior.completedAt) {
      throw new Error(`Cannot start ${phase} before ${predecessor} has completed.`);
    }
  }

  let startedAt = new Date();
  await db.resourceAuthorizationMigrationPhase.upsert({
    where: { runId_phase: { runId, phase } },
    update: {
      status: 'running',
      startedAt,
      completedAt: null,
      failedAt: null,
      failure: undefined
    },
    create: {
      runId,
      phase,
      status: 'running',
      startedAt
    }
  });
  await db.resourceAuthorizationMigrationRun.update({
    where: { runId },
    data: { currentPhase: phase }
  });
  return true;
};

export let completeMigrationPhase = async (runId: string, phase: string, details: unknown) => {
  await db.resourceAuthorizationMigrationPhase.update({
    where: { runId_phase: { runId, phase } },
    data: {
      status: 'completed',
      completedAt: new Date(),
      details: migrationJsonValue(details)
    }
  });
};

export let replaceMigrationArtifacts = async (d: {
  database?: Prisma.TransactionClient;
  runId: string;
  stage: string;
  kind: string;
  immutable: boolean;
  preserveApprovalsByFingerprint?: boolean;
  artifacts: {
    recordKey: string;
    classification: string;
    payload: unknown;
  }[];
}) => {
  let replace = async (tx: Prisma.TransactionClient) => {
    let approvals = d.preserveApprovalsByFingerprint
      ? await tx.resourceAuthorizationMigrationArtifact.findMany({
          where: { runId: d.runId, stage: d.stage, kind: d.kind },
          include: { approvals: true }
        })
      : [];
    let approvalByFingerprint = new Map(
      approvals.flatMap(artifact => {
        let fingerprint = (artifact.payload as { sourceFingerprint?: string })
          .sourceFingerprint;
        return fingerprint
          ? artifact.approvals.map(approval => [fingerprint, approval] as const)
          : [];
      })
    );
    let existing = await tx.resourceAuthorizationMigrationArtifact.count({
      where: { runId: d.runId, stage: d.stage, kind: d.kind }
    });
    if (d.immutable && existing > 0) {
      return { count: existing, reused: true };
    }
    if (!d.immutable) {
      await tx.resourceAuthorizationMigrationArtifact.deleteMany({
        where: { runId: d.runId, stage: d.stage, kind: d.kind }
      });
    }
    await tx.resourceAuthorizationMigrationArtifact.createMany({
      data: d.artifacts.map(artifact => ({
        runId: d.runId,
        stage: d.stage,
        kind: d.kind,
        recordKey: artifact.recordKey,
        classification: artifact.classification,
        payload: migrationJsonValue(artifact.payload)
      })),
      skipDuplicates: d.immutable
    });
    if (approvalByFingerprint.size > 0) {
      let refreshed = await tx.resourceAuthorizationMigrationArtifact.findMany({
        where: { runId: d.runId, stage: d.stage, kind: d.kind }
      });
      for (let artifact of refreshed) {
        let fingerprint = (artifact.payload as { sourceFingerprint?: string })
          .sourceFingerprint;
        let approval = fingerprint ? approvalByFingerprint.get(fingerprint) : null;
        if (!approval) continue;
        await tx.resourceAuthorizationMigrationApproval.create({
          data: {
            runId: d.runId,
            artifactOid: artifact.oid,
            classification: approval.classification,
            reason: approval.reason,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt
          }
        });
      }
    }
    return { count: d.artifacts.length, reused: false };
  };
  if (d.database) return await replace(d.database);
  return await db.$transaction(replace);
};
