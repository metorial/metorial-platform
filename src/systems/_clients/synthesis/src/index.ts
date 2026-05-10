import { createClient } from '@lowerdeck/rpc-client';
import type { SynthesisClient } from '../../../synthesis/service/src/controllers';
export * from '../../../synthesis/service/src/lib/delta/client';
export * from '../../../synthesis/service/src/lib/delta/types';
export * from '../../../synthesis/service/src/types';

type ClientOpts = Parameters<typeof createClient>[0];

export type SynthesisAssistantRequestLiveEndpoints = {
  liveEndpoint: string;
};

export type SynthesisAssistantRequestLiveInput = {
  assistantRequestId: string;
};

export let createSynthesisClient = (o: ClientOpts): SynthesisClient =>
  createClient<SynthesisClient>(o);

export let getAssistantRequestDeltasUrl = (
  endpoints: SynthesisAssistantRequestLiveEndpoints,
  input: SynthesisAssistantRequestLiveInput
) => {
  let url = new URL(
    `${endpoints.liveEndpoint.replace(/\/$/, '')}/assistant-live/requests/${input.assistantRequestId}/deltas`
  );

  return url.toString();
};

export let createAssistantRequestDeltasConnection = (
  endpoints: SynthesisAssistantRequestLiveEndpoints,
  input: SynthesisAssistantRequestLiveInput
) => new EventSource(getAssistantRequestDeltasUrl(endpoints, input));
