import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  tenant: idType.sorted('syn_tn_'),
  environment: idType.sorted('syn_env_'),
  tenantActor: idType.sorted('syn_ta_'),

  assistant: idType.sorted('syn_ast_'),
  assistantImplementation: idType.sorted('syn_aim_'),
  assistantInstance: idType.sorted('syn_asi_'),
  assistantConversation: idType.sorted('syn_asc_'),
  assistantConversationParticipant: idType.sorted('syn_acp_'),
  assistantConversationItem: idType.sorted('syn_aci_'),
  assistantMessage: idType.sorted('syn_asm_'),
  model: idType.sorted('syn_mod_'),
  modelProvider: idType.sorted('syn_mpr_'),
  assistantRequest: idType.sorted('syn_asq_'),
  modelRun: idType.sorted('syn_mrn_'),
  assistantConfig: idType.sorted('syn_acf_')
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
