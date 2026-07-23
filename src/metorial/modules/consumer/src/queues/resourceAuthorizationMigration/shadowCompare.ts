import { db } from '@metorial/db';
import { createHash } from 'node:crypto';
import { inventoryLegacyAccess } from './inventory';
import { replaceMigrationArtifacts } from './artifacts';
import { replayCanonicalAccessSample } from './predicateReplay';
import { normalizeMigrationParticipantPolicies } from './reconcileAccess';

type EffectiveRow = {
  profileOid: string;
  instanceOid: string;
  surfaceOid: string;
  resourceGroupOid: string | null;
  resourceType: string;
  resourceOid: string;
  action: string;
  source: string;
  sourceOid: string;
};

let effectiveKey = (row: EffectiveRow) =>
  [
    row.instanceOid,
    row.surfaceOid,
    row.resourceGroupOid ?? 'none',
    row.profileOid,
    row.resourceType,
    row.resourceOid,
    row.action
  ].join(':');

let loadEffective = async (runId: string, stage: string) => {
  let artifacts = await db.resourceAuthorizationMigrationArtifact.findMany({
    where: { runId, stage, kind: 'effective_access' }
  });
  let byKey = new Map<string, { row: EffectiveRow; sources: string[] }>();
  for (let artifact of artifacts) {
    let row = artifact.payload as unknown as EffectiveRow;
    let key = effectiveKey(row);
    let current = byKey.get(key) ?? { row, sources: [] };
    current.sources.push(`${row.source}:${row.sourceOid}`);
    byKey.set(key, current);
  }
  return byKey;
};

let compareStages = async (d: {
  runId: string;
  stage: string;
  before: string;
  after: string;
  removedClassification: string;
  newClassification: string;
}) => {
  let [before, after] = await Promise.all([
    loadEffective(d.runId, d.before),
    loadEffective(d.runId, d.after)
  ]);
  let keys = new Set([...before.keys(), ...after.keys()]);
  let differences = 0;
  let artifacts: {
    recordKey: string;
    classification: string;
    payload: unknown;
  }[] = [];
  for (let key of keys) {
    let oldAccess = before.get(key);
    let newAccess = after.get(key);
    let classification =
      oldAccess && newAccess
        ? 'preserved'
        : oldAccess
          ? d.removedClassification
          : d.newClassification;
    if (classification != 'preserved') differences++;
    let row = oldAccess?.row ?? newAccess!.row;
    let beforeSources = [...(oldAccess?.sources ?? [])].sort();
    let afterSources = [...(newAccess?.sources ?? [])].sort();
    let sourceFingerprint = createHash('sha256')
      .update(
        JSON.stringify({
          key,
          classification,
          beforeSources,
          afterSources
        })
      )
      .digest('hex');
    artifacts.push({
      recordKey: key,
      classification,
      payload: {
        ...row,
        beforeSources,
        afterSources,
        sourceFingerprint
      }
    });
  }
  await replaceMigrationArtifacts({
    runId: d.runId,
    stage: d.stage,
    kind: 'access_diff',
    immutable: false,
    preserveApprovalsByFingerprint: true,
    artifacts
  });
  return { compared: keys.size, differences };
};

export let shadowCompareCanonicalAccess = async (d: { runId: string }) => {
  await inventoryLegacyAccess({ runId: d.runId, stage: 'canonical' });
  let nonTagCanonicalRows = await db.resourceAuthorizationMigrationArtifact.findMany({
    where: {
      runId: d.runId,
      stage: 'canonical',
      kind: 'effective_access',
      NOT: [
        { payload: { path: ['source'], equals: 'access_tag_entity' } },
        { payload: { path: ['source'], equals: 'skill_group_inheritance' } },
        { payload: { path: ['source'], equals: 'skill_marketplace_inheritance' } },
        { payload: { path: ['source'], equals: 'group_share_and_skill_write' } }
      ]
    }
  });
  if (nonTagCanonicalRows.length > 0) {
    throw new Error(
      `Canonical inventory contains ${nonTagCanonicalRows.length} non-tag authorization rows.`
    );
  }

  let actorDiff = await compareStages({
    runId: d.runId,
    stage: 'actor_diff',
    before: 'pre_actor',
    after: 'post_actor',
    removedClassification: 'removed',
    newClassification: 'new'
  });
  let accessDiff = await compareStages({
    runId: d.runId,
    stage: 'canonical_diff',
    before: 'post_actor',
    after: 'canonical',
    removedClassification: 'removed',
    newClassification: 'new'
  });
  let predicateReplay = await replayCanonicalAccessSample({ runId: d.runId });

  let unsafe = await db.resourceAuthorizationMigrationArtifact.findMany({
    where: {
      runId: d.runId,
      stage: { in: ['actor_diff', 'canonical_diff'] },
      classification: { in: ['removed', 'new', 'stale_legacy'] }
    },
    include: { approvals: true }
  });
  let unexplained = unsafe.filter(
    artifact =>
      artifact.classification != 'new' ||
      !artifact.approvals.some(
        approval =>
          approval.classification == 'expected_new' &&
          approval.reason.trim().length > 0 &&
          approval.approvedBy.trim().length > 0
      )
  );
  if (unexplained.length > 0) {
    throw new Error(
      `Resource authorization shadow comparison has ${unexplained.length} unexplained differences.`
    );
  }

  return { actorDiff, accessDiff, predicateReplay };
};

export let finalizeResourceAuthorizationMigration = async (d: { runId: string }) => {
  let [unresolved, replayMismatches, unsafeDiffs, phases] = await Promise.all([
    db.resourceAuthorizationMigrationArtifact.count({
      where: {
        runId: d.runId,
        classification: { in: ['unresolved', 'ambiguous', 'stale_legacy'] }
      }
    }),
    db.resourceAuthorizationMigrationArtifact.count({
      where: {
        runId: d.runId,
        stage: 'predicate_replay',
        classification: 'mismatch'
      }
    }),
    db.resourceAuthorizationMigrationArtifact.count({
      where: {
        runId: d.runId,
        stage: { in: ['actor_diff', 'canonical_diff'] },
        classification: { in: ['removed', 'new', 'stale_legacy'] },
        approvals: { none: { classification: 'expected_new' } }
      }
    }),
    db.resourceAuthorizationMigrationPhase.findMany({
      where: { runId: d.runId, status: 'completed' },
      select: { phase: true, startedAt: true, completedAt: true }
    })
  ]);
  let required = [
    'inventory_pre_actor',
    'reconcile_actors',
    'inventory_post_actor',
    'reconcile_access',
    'shadow_compare'
  ];
  let completed = new Set(phases.map(phase => phase.phase));
  let missing = required.filter(phase => !completed.has(phase));
  let ordered = required.every((phase, index) => {
    let current = phases.find(item => item.phase == phase);
    let previous = index == 0 ? null : phases.find(item => item.phase == required[index - 1]);
    return (
      current?.startedAt != null &&
      current.completedAt != null &&
      current.completedAt >= current.startedAt &&
      (!previous?.completedAt || current.startedAt >= previous.completedAt)
    );
  });
  if (unresolved || unsafeDiffs || replayMismatches || missing.length || !ordered) {
    throw new Error(
      `Cannot finalize resource authorization migration: unresolved=${unresolved}, unsafeDiffs=${unsafeDiffs}, replayMismatches=${replayMismatches}, missing=${missing.join(',')}, ordered=${ordered}.`
    );
  }
  let normalization = await normalizeMigrationParticipantPolicies({ runId: d.runId });
  return { unresolved, unsafeDiffs, ...normalization };
};
