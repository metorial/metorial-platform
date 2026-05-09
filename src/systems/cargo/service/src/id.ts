import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('ctn_'),
  environment: idType.sorted('cen_'),
  tenantActor: idType.sorted('cta_'),
  filePurpose: idType.sorted('cfp_'),
  file: idType.sorted('cfi_'),
  fileLink: idType.sorted('cfl_'),
  fileRef: idType.sorted('cfr_'),
  store: idType.sorted('cst_'),
  skill: idType.sorted('csk_'),
  storeItem: idType.sorted('csti_'),
  storeParticipant: idType.sorted('cstp_'),
  document: idType.sorted('cdoc_'),
  documentContent: idType.sorted('cdocn_'),
  documentParticipant: idType.sorted('cdocp_'),
  documentVersion: idType.sorted('cdocv_'),
  documentVersionEditor: idType.sorted('cdocve_')
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
