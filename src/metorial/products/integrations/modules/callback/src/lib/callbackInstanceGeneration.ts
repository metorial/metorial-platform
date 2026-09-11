import type { CallbackInstance } from '@metorial-subspace/db';

type CallbackInstanceBinding = Pick<
  CallbackInstance,
  | 'callbackOid'
  | 'providerConfigVersionOid'
  | 'providerAuthConfigVersionOid'
  | 'generationStatus'
>;

export let selectCallbackInstanceGenerations = <T extends CallbackInstanceBinding>(d: {
  active: T[];
  callbackOid: bigint;
  providerConfigVersionOid: bigint;
  providerAuthConfigVersionOid: bigint | null;
}) => {
  let matches = (callbackInstance: T) =>
    callbackInstance.callbackOid === d.callbackOid &&
    callbackInstance.providerConfigVersionOid === d.providerConfigVersionOid &&
    callbackInstance.providerAuthConfigVersionOid === d.providerAuthConfigVersionOid;

  let primary = d.active.find(
    callbackInstance =>
      callbackInstance.generationStatus === 'primary' && matches(callbackInstance)
  );
  let provisioning = d.active.find(
    callbackInstance =>
      callbackInstance.generationStatus === 'provisioning' && matches(callbackInstance)
  );

  return {
    primary,
    provisioning,
    obsolete: d.active.filter(
      callbackInstance => callbackInstance !== primary && callbackInstance !== provisioning
    )
  };
};
