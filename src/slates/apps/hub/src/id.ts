import { createIdGenerator, idType } from '@lowerdeck/id';
import { Snowflake } from '@lowerdeck/snowflake';

export let ID = createIdGenerator({
  hub: idType.sorted('shhub'),
  tenant: idType.sorted('shtn'),

  registry: idType.sorted('shreg'),
  registrySync: idType.sorted('shrsn'),

  deploymentProvider: idType.sorted('shdpv'),

  secret: idType.sorted('shsec'),

  slate: idType.sorted('shslt'),
  slateVersion: idType.sorted('shslv'),
  slateVersionDiscovery: idType.sorted('shvd'),
  slateDeployment: idType.sorted('shdpl'),
  slateEvent: idType.sorted('shsev'),
  slateSpecification: idType.sorted('shspe'),
  slateSpecificationChange: idType.sorted('shspc'),
  slateAction: idType.sorted('shac'),
  slateConfigSchema: idType.sorted('shcs'),
  slateAuthMethod: idType.sorted('sham'),

  slateInstance: idType.sorted('shin'),
  slateInstanceConfig: idType.sorted('shic'),
  slateInstanceConfiguration: idType.sorted('shinc'),
  slateAuthConfig: idType.sorted('shiac'),
  slateInstanceEvent: idType.sorted('hsiev'),
  slateInstanceOAuthSetup: idType.sorted('shios'),
  slateAuthConfigEvent: idType.sorted('shace'),
  slateInstanceOAuthSetupEvent: idType.sorted('shiose'),

  slateInvocation: idType.sorted('shiv'),
  slateScopedInvocationGrant: idType.sorted('shsig'),

  slateOAuthCredentials: idType.sorted('shoc'),
  slateToolCall: idType.sorted('shtc'),
  slateSession: idType.sorted('shses'),

  slateTriggerReceiver: idType.sorted('shtr'),
  slateTriggerReceiverTrigger: idType.sorted('shtrt'),
  slateTriggerInvocation: idType.sorted('shtiv'),
  slateTriggerEventInput: idType.sorted('shtin'),
  slateTriggerEvent: idType.sorted('shte'),
  slateTriggerWebhookRequest: idType.sorted('shtwr'),
  slateTriggerWebhookReplayClaim: idType.sorted('shtwc'),
  slateTriggerWebhookDispatchOutbox: idType.sorted('shtwo'),
  slateTriggerRegistrationOutbox: idType.sorted('shtro'),
  slateProvisionedAppRouteProjection: idType.sorted('shpar'),
  slateProvisionedTenantAppProjection: idType.sorted('shpap'),

  changeNotification: idType.sorted('shcn'),

  adminUser: idType.sorted('shadu'),
  adminSession: idType.sorted('shads'),

  slateAttachment: idType.sorted('shsa'),
  slateInvocationAttachment: idType.sorted('shsia'),

  slateError: idType.sorted('sher')
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
