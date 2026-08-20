import type { ProviderEventBase } from '@metorial/fabric';

export let toEventBase = (params: Record<string, any>): ProviderEventBase => {
  let { instance, organizationActor, ...input } = params;
  return { instance, organizationActor, input };
};
