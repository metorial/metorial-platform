import type { ClaudeCostState, ClaudeMessageUsage } from './claude';
import { codexAsServiceTokens, type CodexRollout } from './codex';
import { addTokens, emptyTokens, type Tokens } from '@mtsrc/agent-tracking-cost';
import { sumTokens, tokenComponents, type TokenComponent } from './tokens';

// Claude Code reports a cost per request and adds the same figures up itself, so the two
// totals differ only by float rounding: a micro-dollar per request is generous for that.
let costToleranceUsdPerRequest = 0.000001;

let exactComponents = ['inputUncached', 'output', 'cacheRead', 'cacheWrite'] as const;

export let explanations = {
  thinking_only_in_transcript: {
    failure: false,
    description:
      'Thinking tokens exist only in transcripts; Claude Code does not send them over OTel.'
  },
  no_catalog_offering: {
    failure: false,
    description:
      'Computed cost differs because the catalog has no offering for a model of the session at that vendor.'
  },
  price_changed_in_session: {
    failure: false,
    description: 'Computed cost differs because a price changed during the session.'
  },
  counted_per_content_block: {
    failure: true,
    description:
      'The figure equals a reading that counts every content-block line of a message, which double counts.'
  },
  counted_iterations: {
    failure: true,
    description:
      'The figure equals a reading that adds the iterations list of a usage block on top of its counts.'
  }
} as const;

export type ExplanationKey = keyof typeof explanations;

type Check =
  | 'tokens'
  | 'model_tokens'
  | 'model_missing'
  | 'reported_cost'
  | 'computed_cost'
  | 'model_reported_cost'
  | 'model_computed_cost'
  | 'message_floor';

type Finding = {
  check: Check;
  model: string | null;
  component: TokenComponent | null;
  client: number | null;
  service: number | null;
  explanation: ExplanationKey | null;
  failure: boolean;
};

export type ServiceModel = {
  modelId: string | null;
  rawIds: string[];
  requests: number;
  tokens: Tokens;
  reportedCostUsd: number | null;
  computedCostUsd: number | null;
  hasOffering: boolean;
  pricePeriods: number;
};

export type ServiceSession = {
  sessionKey: string;
  family: string;
  instanceId: string;
  startedAt: Date | null;
  summaryStale: boolean;
  requests: number;
  toolCalls: number;
  tokens: Tokens;
  reportedCostUsd: number | null;
  computedCostUsd: number | null;
  models: ServiceModel[];
};

export type ClaudeComparison = {
  reference: 'cost_state' | 'messages';
  costStateBehind: boolean;
  status: 'pass' | 'fail';
  findings: Finding[];
};

export type CodexComparison = {
  tokensMatch: boolean;
  differences: Partial<Record<TokenComponent, number>>;
  computedCostUsd: number | null;
};

export let costTolerance = (requests: number) =>
  costToleranceUsdPerRequest * Math.max(1, requests);

let costsAgree = (a: number, b: number, requests: number) =>
  Math.abs(a - b) <= costTolerance(requests);

let finding = (
  d: Omit<Finding, 'failure' | 'model' | 'component'> & Partial<Finding>
): Finding => ({
  model: null,
  component: null,
  ...d,
  failure: d.explanation ? explanations[d.explanation].failure : true
});

let doubleCount = (
  component: TokenComponent,
  value: number,
  messages: ClaudeMessageUsage
): ExplanationKey | null => {
  let counted = messages.tokens[component];

  if (
    value != counted &&
    value == messages.perLine[component] &&
    messages.perLine[component] != counted
  )
    return 'counted_per_content_block';
  if (
    value != counted &&
    value == messages.withIterations[component] &&
    messages.withIterations[component] != counted
  )
    return 'counted_iterations';

  return null;
};

let thinkingFinding = (
  client: number,
  service: number,
  model: string | null
): Finding | null => {
  if (client == service) return null;

  return finding({
    check: model ? 'model_tokens' : 'tokens',
    model,
    component: 'reasoning',
    client,
    service,
    explanation: service == 0 && client > 0 ? 'thinking_only_in_transcript' : null
  });
};

let computedExplanation = (models: ServiceModel[], computed: number | null) => {
  if (
    computed === null ||
    models.some(model => !model.hasOffering || model.computedCostUsd === null)
  )
    return 'no_catalog_offering' as const;
  if (models.some(model => model.pricePeriods > 1)) return 'price_changed_in_session' as const;

  return null;
};

let costFindings = (d: {
  checks: { reported: Check; computed: Check };
  model: string | null;
  client: number;
  reported: number | null;
  computed: number | null;
  requests: number;
  models: ServiceModel[];
}) => {
  let findings: Finding[] = [];

  if (d.reported === null || !costsAgree(d.reported, d.client, d.requests)) {
    findings.push(
      finding({
        check: d.checks.reported,
        model: d.model,
        client: d.client,
        service: d.reported,
        explanation: null
      })
    );
  }

  if (d.computed === null || !costsAgree(d.computed, d.client, d.requests)) {
    findings.push(
      finding({
        check: d.checks.computed,
        model: d.model,
        client: d.client,
        service: d.computed,
        explanation: computedExplanation(d.models, d.computed)
      })
    );
  }

  return findings;
};

let serviceModelFor = (service: ServiceSession, model: string) =>
  service.models.find(item => item.rawIds.includes(model) || item.modelId == model);

let compareTokens = (d: {
  check: 'tokens' | 'model_tokens';
  model: string | null;
  client: Tokens;
  service: Tokens;
  messages: ClaudeMessageUsage | null;
}) => {
  let findings: Finding[] = [];

  for (let component of exactComponents) {
    let client = d.client[component];
    let service = d.service[component];
    if (client == service) continue;

    findings.push(
      finding({
        check: d.check,
        model: d.model,
        component,
        client,
        service,
        explanation: d.messages ? doubleCount(component, service, d.messages) : null
      })
    );
  }

  let thinking = thinkingFinding(d.client.reasoning, d.service.reasoning, d.model);
  if (thinking) findings.push(thinking);

  return findings;
};

// The cost-state entry is the client's own total and the reference. A sum over the
// transcript's messages leaves out requests the client makes on the side, so it is only a
// floor; when it is above the cost-state, the cost-state was not saved last (a crash) and the
// floor is all that is left to check against.
export let compareClaudeSession = (d: {
  costState: ClaudeCostState | null;
  messages: ClaudeMessageUsage;
  service: ServiceSession;
}): ClaudeComparison => {
  let findings: Finding[] = [];
  let costStateTokens = d.costState
    ? sumTokens(d.costState.models.map(model => model.tokens))
    : null;
  let costStateBehind =
    !!costStateTokens &&
    exactComponents.some(
      component => d.messages.tokens[component] > costStateTokens![component]
    );

  if (d.costState && costStateTokens && !costStateBehind) {
    findings.push(
      ...compareTokens({
        check: 'tokens',
        model: null,
        client: costStateTokens,
        service: d.service.tokens,
        messages: d.messages
      })
    );

    // The service files a request under its canonical model, so several raw ids the client
    // keeps apart (a dated id and its alias) are one model there and are compared together.
    let groups = new Map<ServiceModel, { names: string[]; tokens: Tokens; costUsd: number }>();

    for (let model of d.costState.models) {
      let serviceModel = serviceModelFor(d.service, model.model);

      if (!serviceModel) {
        if (exactComponents.some(component => model.tokens[component] > 0)) {
          findings.push(
            finding({
              check: 'model_missing',
              model: model.model,
              client: null,
              service: null,
              explanation: null
            })
          );
        }
        continue;
      }

      let group = groups.get(serviceModel) ?? { names: [], tokens: emptyTokens(), costUsd: 0 };
      group.names.push(model.model);
      addTokens(group.tokens, model.tokens);
      group.costUsd += model.costUsd;
      groups.set(serviceModel, group);
    }

    for (let [serviceModel, group] of groups) {
      let label = serviceModel.modelId ?? group.names.join('+');

      findings.push(
        ...compareTokens({
          check: 'model_tokens',
          model: label,
          client: group.tokens,
          service: serviceModel.tokens,
          messages: null
        }),
        ...costFindings({
          checks: { reported: 'model_reported_cost', computed: 'model_computed_cost' },
          model: label,
          client: group.costUsd,
          reported: serviceModel.reportedCostUsd,
          computed: serviceModel.computedCostUsd,
          requests: serviceModel.requests,
          models: [serviceModel]
        })
      );
    }

    findings.push(
      ...costFindings({
        checks: { reported: 'reported_cost', computed: 'computed_cost' },
        model: null,
        client: d.costState.totalCostUsd,
        reported: d.service.reportedCostUsd,
        computed: d.service.computedCostUsd,
        requests: d.service.requests,
        models: d.service.models
      })
    );
  }

  for (let component of exactComponents) {
    let floor = d.messages.tokens[component];
    let service = d.service.tokens[component];
    if (service >= floor) continue;

    findings.push(
      finding({ check: 'message_floor', component, client: floor, service, explanation: null })
    );
  }

  return {
    reference: d.costState && !costStateBehind ? 'cost_state' : 'messages',
    costStateBehind,
    status: findings.some(item => item.failure) ? 'fail' : 'pass',
    findings
  };
};

export let compareCodexSession = (d: {
  rollout: CodexRollout;
  service: ServiceSession;
}): CodexComparison => {
  let differences: Partial<Record<TokenComponent, number>> = {};
  let client = d.rollout.total ? codexAsServiceTokens(d.rollout.total) : null;

  for (let component of tokenComponents) {
    let difference = d.service.tokens[component] - (client?.[component] ?? 0);
    if (difference != 0) differences[component] = difference;
  }

  return {
    tokensMatch: !!client && Object.keys(differences).length == 0,
    differences,
    computedCostUsd: d.service.computedCostUsd
  };
};

export type ClientOnlyComparison = {
  equal: boolean;
  differences: Partial<Record<TokenComponent, number>>;
  costStateBehind: boolean;
};

export let compareCostStateWithMessages = (d: {
  costState: ClaudeCostState;
  messages: ClaudeMessageUsage;
}): ClientOnlyComparison => {
  let costStateTokens = sumTokens(d.costState.models.map(model => model.tokens));
  let differences: Partial<Record<TokenComponent, number>> = {};

  for (let component of tokenComponents) {
    let difference = costStateTokens[component] - d.messages.tokens[component];
    if (difference != 0) differences[component] = difference;
  }

  return {
    equal: Object.keys(differences).length == 0,
    differences,
    costStateBehind: exactComponents.some(component => (differences[component] ?? 0) < 0)
  };
};
