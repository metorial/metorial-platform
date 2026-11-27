import type { CallbackInstance } from '@metorial-subspace/db';

type CallbackInstanceBinding = Pick<
  CallbackInstance,
  | 'callbackOid'
  | 'providerConfigVersionOid'
  | 'providerAuthConfigVersionOid'
  | 'generationStatus'
  | 'triggerGroupSelections'
>;

let canonicalJson = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson((value as any)[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

export let sameTriggerGroupSelections = (
  a: PrismaJson.TriggerGroupSelections | null | undefined,
  b: PrismaJson.TriggerGroupSelections | null | undefined
) => canonicalJson(a ?? {}) === canonicalJson(b ?? {});

export let changedTriggerGroupKeys = (
  previous: PrismaJson.TriggerGroupSelections | null | undefined,
  next: PrismaJson.TriggerGroupSelections | null | undefined
) => {
  let a = previous ?? {};
  let b = next ?? {};

  return [...new Set([...Object.keys(a), ...Object.keys(b)])]
    .filter(key => canonicalJson(a[key]) !== canonicalJson(b[key]))
    .sort();
};

export let selectCallbackInstanceGenerations = <T extends CallbackInstanceBinding>(d: {
  active: T[];
  callbackOid: bigint;
  providerConfigVersionOid: bigint;
  providerAuthConfigVersionOid: bigint | null;
  triggerGroupSelections: PrismaJson.TriggerGroupSelections | null;
}) => {
  let matches = (callbackInstance: T) =>
    callbackInstance.callbackOid === d.callbackOid &&
    callbackInstance.providerConfigVersionOid === d.providerConfigVersionOid &&
    callbackInstance.providerAuthConfigVersionOid === d.providerAuthConfigVersionOid &&
    sameTriggerGroupSelections(
      callbackInstance.triggerGroupSelections,
      d.triggerGroupSelections
    );

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
