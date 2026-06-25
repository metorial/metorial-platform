import type { SessionMessage } from '@metorial-subspace/db';
import { extractProtoGuardScanTargets } from './extractText';
import { scoreProtoGuardResults } from './score';
import { getEffectiveProtoGuardFilters } from './tenantSettings';

export let evaluateProtoGuardMessage = async (message: SessionMessage) => {
  let targets = extractProtoGuardScanTargets(message);
  let { filters, alertFilterCountThreshold } = await getEffectiveProtoGuardFilters({
    tenant: { tenantOid: message.tenantOid }
  });

  let ctx = { message, targets };
  let score = scoreProtoGuardResults({
    ctx,
    filters,
    alertFilterCountThreshold
  });

  return {
    targets,
    filters,
    alertFilterCountThreshold,
    score
  };
};
