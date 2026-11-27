import { db, getId, type ProtoGuardFilter } from '@metorial-subspace/db';
import { activeRuleset } from '../definitions/rulesets';

let syncPromise: Promise<Map<string, ProtoGuardFilter>> | null = null;

let upsertFamilies = async () => {
  let filters = await Promise.all(
    activeRuleset.families.map(family => {
      let data = {
        name: family.name,
        description: family.description,
        issueType: family.issueType as ProtoGuardFilter['issueType'],
        severity: family.severity,
        scoreWeight: family.scoreWeight,
        defaultEnabled: family.defaultEnabled,
        alertConfidenceThreshold: family.alertConfidenceThreshold,
        stage: family.stage
      };

      return db.protoGuardFilter.upsert({
        where: { key: family.key },
        update: data,
        create: { ...getId('protoGuardFilter'), key: family.key, ...data }
      });
    })
  );

  await db.protoGuardFilter.updateMany({
    where: {
      key: { notIn: activeRuleset.families.map(family => family.key) },
      stage: { not: 'deprecated' }
    },
    data: { stage: 'deprecated' }
  });

  return new Map(filters.map(filter => [filter.key, filter]));
};

// Families are code-defined; the table exists so tenant settings, alert instances, and monitors
// can reference them. Syncing once per process keeps the rows in step with the deployed ruleset.
export let syncProtoGuardFilters = async () => {
  if (syncPromise) return await syncPromise;

  let promise = upsertFamilies();
  syncPromise = promise;

  promise.catch(() => {
    if (syncPromise === promise) syncPromise = null;
  });

  return await promise;
};
