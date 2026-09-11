import { getProtoGuardConfigForEvaluation } from '@metorial-subspace/module-monitor';
import { protoGuardFilterDefinitions } from './filters';
import { syncProtoGuardFilters } from './registry';

export let getEffectiveProtoGuardFilters = async (d: { tenant: { tenantOid: bigint } }) => {
  await syncProtoGuardFilters();
  let config = await getProtoGuardConfigForEvaluation({ tenantOid: d.tenant.tenantOid });
  let configByKey = new Map(config.filters.map(filter => [filter.key, filter]));

  let effectiveFilters = protoGuardFilterDefinitions.flatMap(definition => {
    let config = configByKey.get(definition.key);
    if (!config?.enabled) return [];

    return [
      {
        definition,
        filterOid: config.oid,
        alertConfidenceThreshold: config.alertConfidenceThreshold
      }
    ];
  });

  return {
    filters: effectiveFilters,
    alertFilterCountThreshold: config.alertFilterCountThreshold
  };
};
