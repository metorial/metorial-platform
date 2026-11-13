import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  organization: idType.sorted('ator_'),
  project: idType.sorted('atpr_'),
  instance: idType.sorted('atin_'),
  ingestToken: idType.sorted('atit_'),
  ingestSource: idType.sorted('atis_'),
  entityKind: idType.sorted('atek_'),
  entity: idType.sorted('aten_'),
  entityIdentifier: idType.sorted('atei_'),
  entityLink: idType.sorted('atel_'),
  pendingMembership: idType.sorted('atpm_'),
  attributionRule: idType.sorted('atru_'),
  classifierLabel: idType.sorted('atcl_'),
  mergeSuggestion: idType.sorted('atms_'),
  rebuildRun: idType.sorted('atrb_'),
  knowledgeSource: idType.sorted('atku_'),
  knowledgeSnapshot: idType.sorted('atks_'),
  knowledgeChange: idType.sorted('atkc_'),
  knowledgePricePeriod: idType.sorted('atpp_'),
  priceOverride: idType.sorted('atpo_'),
  billingDeclaration: idType.sorted('atbd_')
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
