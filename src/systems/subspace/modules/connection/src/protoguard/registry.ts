import { db, getId, type ProtoGuardFilter } from '@metorial-subspace/db';
import { protoGuardFilterDefinitions } from './filters';

let filterSyncPromise: Promise<ProtoGuardFilter[]> | null = null;

export let syncProtoGuardFilters = async () => {
  if (filterSyncPromise) return await filterSyncPromise;

  filterSyncPromise = Promise.all(
    protoGuardFilterDefinitions.map(definition =>
      db.protoGuardFilter.upsert({
        where: { key: definition.key },
        update: {
          name: definition.name,
          description: definition.description,
          issueType: definition.issueType,
          severity: definition.severity,
          scoreWeight: definition.scoreWeight,
          defaultEnabled: definition.defaultEnabled,
          alertConfidenceThreshold: definition.alertConfidenceThreshold
        },
        create: {
          ...getId('protoGuardFilter'),
          key: definition.key,
          name: definition.name,
          description: definition.description,
          issueType: definition.issueType,
          severity: definition.severity,
          scoreWeight: definition.scoreWeight,
          defaultEnabled: definition.defaultEnabled,
          alertConfidenceThreshold: definition.alertConfidenceThreshold
        }
      })
    )
  ).finally(() => {
    filterSyncPromise = null;
  });

  return await filterSyncPromise;
};

export let getProtoGuardFilterDefinition = (key: string) =>
  protoGuardFilterDefinitions.find(definition => definition.key === key);
