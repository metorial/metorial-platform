import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  organization: idType.sorted('gor_'),
  project: idType.sorted('gpr_'),
  instance: idType.sorted('gin_'),
  ingestToken: idType.sorted('git_'),
  ingestSource: idType.sorted('gis_'),
  entityKind: idType.sorted('gek_'),
  entity: idType.sorted('gen_'),
  entityIdentifier: idType.sorted('gei_'),
  entityLink: idType.sorted('gel_'),
  pendingMembership: idType.sorted('gpm_'),
  attributionRule: idType.sorted('gru_'),
  classifierLabel: idType.sorted('gcl_'),
  mergeSuggestion: idType.sorted('gms_'),
  rebuildRun: idType.sorted('grb_'),
  knowledgeSource: idType.sorted('gku_'),
  knowledgeSnapshot: idType.sorted('gks_'),
  knowledgeChange: idType.sorted('gkc_'),
  knowledgePricePeriod: idType.sorted('gpp_'),
  priceOverride: idType.sorted('gpo_')
});

let workerIdBits = 12;
let workerIdMask = (1 << workerIdBits) - 1;

let workerId = (() => {
  let array = new Uint16Array(1);
  crypto.getRandomValues(array);
  return array[0]! & workerIdMask;
})();

export let snowflake = new Snowflake({
  workerId,
  datacenterId: 0,
  workerIdBits: workerIdBits,
  datacenterIdBits: 0,
  sequenceBits: 9,
  epoch: new Date('2025-06-01T00:00:00Z')
});

export let getId = <K extends Parameters<typeof ID.generateIdSync>[0]>(model: K) => ({
  oid: snowflake.nextId(),
  id: ID.generateIdSync(model)
});
