import {
  decisionModels,
  type DecisionModelSlug,
  type ProviderConnectionConfig,
  type ProviderCredentials,
  type SignalValues,
  type VirtualModelSignal
} from '@mtsrc/ai-gateway-spec';
import { decisionEndpoint } from './lib/backends';
import { toQuestions, toSignalValues } from './lib/questions';
import type { DecisionState } from './lib/state';
import { callSystemOne } from './lib/systemOne';

export { DecisionError, isDecisionError, type DecisionErrorCode } from './lib/errors';
export { buildDecisionState, decisionStateHash, type DecisionState } from './lib/state';
export { parseSystemOneResponse, type SystemOneAnswer } from './lib/systemOne';
export { toQuestions, toSignalValues };

let defaultTimeoutMs = 400;

export type DecisionResult = {
  signals: SignalValues;
  model: string;
  inputTokens: number;
  costUsd: number;
  latencyMs: number;
};

export let decisionCostUsd = (model: DecisionModelSlug, inputTokens: number) =>
  (inputTokens * decisionModels[model].inputPricePerMillionTokens) / 1_000_000;

export let runDecision = async (d: {
  model: DecisionModelSlug;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
  signals: Record<string, VirtualModelSignal>;
  state: DecisionState;
  timeoutMs?: number;
  fetch?: typeof fetch;
}): Promise<DecisionResult> => {
  let model = decisionModels[d.model];
  let endpoint = decisionEndpoint({ model, credentials: d.credentials, config: d.config });
  let startedAt = Date.now();

  let response = await callSystemOne({
    ...endpoint,
    request: { model: model.vendorModelId, state: d.state, questions: toQuestions(d.signals) },
    timeoutMs: d.timeoutMs ?? defaultTimeoutMs,
    fetch: d.fetch ?? fetch
  });

  return {
    signals: toSignalValues(d.signals, response.answers),
    model: response.model,
    inputTokens: response.usage.inputTokens,
    costUsd: decisionCostUsd(d.model, response.usage.inputTokens),
    latencyMs: Date.now() - startedAt
  };
};
