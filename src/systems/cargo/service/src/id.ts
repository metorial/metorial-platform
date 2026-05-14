import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('crg_tn_'),
  environment: idType.sorted('crg_en_'),
  tenantActor: idType.sorted('crg_ta_'),

  filePurpose: idType.sorted('fp_'),
  file: idType.sorted('fil_'),
  fileLink: idType.sorted('fln_'),
  fileRef: idType.sorted('fr_'),

  storeTemplate: idType.sorted('stt_'),
  storeTemplateItem: idType.sorted('stti_'),
  storeTemplateBacking: idType.sorted('sttb_'),

  store: idType.sorted('str_'),
  storeItem: idType.sorted('sti_'),
  storeDirectory: idType.sorted('std_'),
  storeVersion: idType.sorted('stv_'),
  storeVersionItem: idType.sorted('stvi_'),
  storeParticipant: idType.sorted('stp_'),
  skillAgent: idType.sorted('ska_'),
  skillVersion: idType.sorted('skv_'),
  skillParticipant: idType.sorted('skp_'),

  document: idType.sorted('doc_'),
  documentContent: idType.sorted('docn_'),
  documentParticipant: idType.sorted('docp_'),
  documentVersion: idType.sorted('docv_'),
  documentVersionEditor: idType.sorted('docve_')
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
