import { ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  buildDecisionState,
  decisionStateHash,
  isDecisionError,
  runDecision,
  type DecisionErrorCode,
  type DecisionResult
} from '@mtsrc/ai-gateway-decisions';
import { billingService } from '@mtsrc/ai-gateway-module-billing';
import {
  isModelAllowed,
  modelNotAllowedError,
  routeService,
  type RouteCandidate
} from '@mtsrc/ai-gateway-module-routing';
import {
  summarizeRequest,
  type RequestDialect,
  type RequestSummary
} from '@mtsrc/ai-gateway-request-features';
import type {
  DecisionModelSlug,
  GatewayPrincipal,
  ParameterOverrides,
  ProviderFeature,
  RequestMetadata,
  SignalValues,
  VirtualModelTarget
} from '@mtsrc/ai-gateway-spec';
import { evaluateRules, type RuleTrace } from '../lib/cel';
import { compiledDefinitionFor } from '../lib/compiledCache';
import { resolveDecisionBackend } from '../lib/decisionBackend';
import { definitionTargets } from '../lib/definition';
import { decisionFailedError, noCompatibleTargetError } from '../lib/errors';
import {
  findActiveVirtualModel,
  getTargetProfiles,
  loadTargetProfiles,
  type ActiveVirtualModel
} from '../lib/lookup';
import { createMemo } from '../lib/memo';
import { orderTargets, type SkippedTarget, type TargetProfile } from '../lib/targets';

let decisionCacheTtlSeconds = 3600;
let defaultStickinessTtlSeconds = 3600;

let isServiceOrDecisionError = (error: unknown) =>
  error instanceof ServiceError || isDecisionError(error);

let decisionMemo = createMemo<DecisionResult>({
  name: 'ai-gateway/virtual-model-decisions',
  ttlSeconds: decisionCacheTtlSeconds,
  isComputeError: isServiceOrDecisionError
});

type StickyChoice = { ruleId: string | null; model: string };

let stickyMemo = createMemo<StickyChoice>({
  name: 'ai-gateway/virtual-model-stickiness',
  ttlSeconds: defaultStickinessTtlSeconds,
  isComputeError: isServiceOrDecisionError
});

export type GatewayRouteCandidate = RouteCandidate & {
  model: { slug: string; labSlug: string };
  requestedModel: string;
};

export type DecisionLog = {
  model: DecisionModelSlug;
  source: 'customer' | 'platform' | null;
  cached: boolean;
  latencyMs: number;
  inputTokens: number;
  costUsd: number;
  signals: SignalValues | null;
  error: { code: DecisionErrorCode; message: string } | null;
};

export type VirtualModelRouteLog = {
  id: string;
  slug: string;
  versionId: string;
  versionNumber: number;
  ruleId: string | null;
  reason: 'rule' | 'default' | 'sticky';
  trace: RuleTrace[];
  targets: string[];
  skippedTargets: (SkippedTarget | { model: string; reason: 'unavailable' })[];
  decision: DecisionLog | null;
};

export type GatewayRoute = {
  requestedModel: string;
  candidates: GatewayRouteCandidate[];
  overrides: ParameterOverrides | null;
  virtualModel: VirtualModelRouteLog | null;
};

type Selection = {
  ruleId: string | null;
  reason: VirtualModelRouteLog['reason'];
  trace: RuleTrace[];
  targets: (VirtualModelTarget & { weight: number })[];
  skippedTargets: SkippedTarget[];
  overrides: ParameterOverrides | null;
};

let requiredFeaturesOf = (principal: GatewayPrincipal): ProviderFeature[] =>
  principal.instance.settings.zdrRequired ? ['zdr'] : [];

class VirtualModelRoutingServiceImpl {
  async route(d: {
    principal: GatewayPrincipal;
    model: string;
    dialect: RequestDialect;
    body: unknown;
    metadata: RequestMetadata;
    random?: () => number;
  }): Promise<GatewayRoute> {
    let virtualModel = await findActiveVirtualModel({
      instanceId: d.principal.instance.id,
      slug: d.model
    });
    if (virtualModel) {
      return await this.routeVirtual({
        ...d,
        virtualModel,
        summary: summarizeRequest(d.dialect, d.body),
        useCaches: true
      });
    }

    let routed = await routeService.route({
      principal: d.principal,
      model: d.model,
      random: d.random
    });

    return {
      requestedModel: d.model,
      candidates: routed.candidates.map(candidate => ({
        ...candidate,
        model: routed.model,
        requestedModel: d.model
      })),
      overrides: null,
      virtualModel: null
    };
  }

  async routeVirtual(d: {
    principal: GatewayPrincipal;
    virtualModel: ActiveVirtualModel;
    summary: RequestSummary;
    metadata: RequestMetadata;
    useCaches: boolean;
    resolveCandidates?: boolean;
    presetSignals?: SignalValues;
    random?: () => number;
    now?: Date;
  }): Promise<GatewayRoute> {
    let { virtualModel, principal } = d;
    let random = d.random ?? Math.random;

    if (
      !isModelAllowed({
        allowedModels: principal.token.allowedModels,
        requested: virtualModel.slug,
        modelSlug: virtualModel.slug
      })
    ) {
      throw new ServiceError(modelNotAllowedError());
    }

    let definition = virtualModel.definition;
    let compiled = compiledDefinitionFor(virtualModel.versionId, definition);
    let requiredFeatures = requiredFeaturesOf(principal);

    let targets = definitionTargets(definition);
    let profiles = new Map<string, TargetProfile>(
      Object.entries(
        d.useCaches
          ? await getTargetProfiles({ versionId: virtualModel.versionId, targets }).catch(() =>
              loadTargetProfiles(targets)
            )
          : await loadTargetProfiles(targets)
      )
    );

    let decision: DecisionLog | null = null;

    let resolveSignals = async (): Promise<SignalValues | null> => {
      let config = definition.decision!;

      if (d.presetSignals) {
        decision = {
          model: config.model,
          source: null,
          cached: true,
          latencyMs: 0,
          inputTokens: 0,
          costUsd: 0,
          signals: d.presetSignals,
          error: null
        };

        return d.presetSignals;
      }

      let state = buildDecisionState(d.summary, config.context);
      let startedAt = Date.now();
      let source: DecisionLog['source'] = null;

      try {
        let backend = await resolveDecisionBackend({
          instanceId: principal.instance.id,
          config,
          requiredFeatures,
          billingRestriction: principal.project.billingRestriction
        });
        source = backend.source;

        let run = () =>
          runDecision({
            model: config.model,
            credentials: backend.credentials,
            config: backend.config,
            signals: definition.signals ?? {},
            state,
            timeoutMs: config.timeoutMs
          });

        let { value, cached } = d.useCaches
          ? await decisionMemo(`${virtualModel.versionId}:${decisionStateHash(state)}`, run)
          : { value: await run(), cached: false };

        decision = {
          model: config.model,
          source,
          cached,
          latencyMs: cached ? Date.now() - startedAt : value.latencyMs,
          inputTokens: cached ? 0 : value.inputTokens,
          costUsd: cached ? 0 : value.costUsd,
          signals: value.signals,
          error: null
        };

        if (source == 'platform' && decision.costUsd > 0) {
          billingService.charge({
            projectId: principal.project.id,
            costUsd: decision.costUsd
          });
        }

        return value.signals;
      } catch (error) {
        let code: DecisionErrorCode = isDecisionError(error) ? error.code : 'unavailable';
        let message = error instanceof Error ? error.message : String(error);

        decision = {
          model: config.model,
          source,
          cached: false,
          latencyMs: Date.now() - startedAt,
          inputTokens: 0,
          costUsd: 0,
          signals: null,
          error: { code, message }
        };

        if (config.onError == 'fail') {
          throw new ServiceError(
            decisionFailedError({
              message: `The decision model could not classify the request: ${message}`
            })
          );
        }

        return null;
      }
    };

    let targetsOf = (ruleId: string | null) => {
      let rule = ruleId ? definition.rules.find(rule => rule.id == ruleId) : null;
      if (ruleId && !rule) return null;

      return rule
        ? { models: rule.models, overrides: rule.overrides ?? null }
        : {
            models: definition.default.models,
            overrides: definition.default.overrides ?? null
          };
    };

    let select = async (): Promise<Selection> => {
      let evaluation = await evaluateRules({
        compiled,
        context: {
          summary: d.summary,
          metadata: d.metadata,
          token: principal.token,
          now: d.now ?? new Date()
        },
        resolveSignals
      });

      let ruleId = evaluation.rule?.id ?? null;
      let chosen = targetsOf(ruleId)!;
      let ordered = orderTargets({
        targets: chosen.models,
        profiles,
        summary: d.summary,
        random
      });

      return {
        ruleId,
        reason: ruleId ? 'rule' : 'default',
        trace: evaluation.trace,
        targets: ordered.ordered,
        skippedTargets: ordered.skipped,
        overrides: chosen.overrides
      };
    };

    let selection = await this.selectWithStickiness({
      ...d,
      select,
      targetsOf,
      profiles,
      random
    });

    let routeLog = (unavailable: { model: string; reason: 'unavailable' }[]) => ({
      id: virtualModel.id,
      slug: virtualModel.slug,
      versionId: virtualModel.versionId,
      versionNumber: virtualModel.versionNumber,
      ruleId: selection.ruleId,
      reason: selection.reason,
      trace: selection.trace,
      targets: selection.targets.map(target => target.model),
      skippedTargets: [...selection.skippedTargets, ...unavailable],
      decision
    });

    if (d.resolveCandidates === false) {
      return {
        requestedModel: virtualModel.slug,
        candidates: [],
        overrides: selection.overrides,
        virtualModel: routeLog([])
      };
    }

    if (!selection.targets.length) throw new ServiceError(noCompatibleTargetError());

    let routed = await Promise.all(
      selection.targets.map(target =>
        routeService
          .route({
            principal,
            model: target.model,
            random,
            allowedModelsChecked: true
          })
          .then(result => ({ target, result }))
          .catch(error => {
            if (error instanceof ServiceError) return { target, result: null };
            throw error;
          })
      )
    );

    let seenModels = new Set<string>();
    let candidates: GatewayRouteCandidate[] = [];
    let unavailable: { model: string; reason: 'unavailable' }[] = [];

    for (let { target, result } of routed) {
      if (!result) {
        unavailable.push({ model: target.model, reason: 'unavailable' });
        continue;
      }
      if (seenModels.has(result.model.slug)) continue;
      seenModels.add(result.model.slug);

      candidates.push(
        ...result.candidates.map(candidate => ({
          ...candidate,
          model: result.model,
          requestedModel: target.model
        }))
      );
    }

    if (!candidates.length) throw new ServiceError(noCompatibleTargetError());

    return {
      requestedModel: virtualModel.slug,
      candidates,
      overrides: selection.overrides,
      virtualModel: routeLog(unavailable)
    };
  }

  // A conversation keyed by the stickiness metadata keeps the rule and model it was first routed to,
  // which preserves provider prompt caches. The pin is dropped for a request the pinned model
  // cannot handle (an image arriving mid-conversation, for example).
  private async selectWithStickiness(d: {
    virtualModel: ActiveVirtualModel;
    summary: RequestSummary;
    metadata: RequestMetadata;
    useCaches: boolean;
    select: () => Promise<Selection>;
    targetsOf: (ruleId: string | null) => {
      models: VirtualModelTarget[];
      overrides: ParameterOverrides | null;
    } | null;
    profiles: Map<string, TargetProfile>;
    random: () => number;
  }): Promise<Selection> {
    let stickiness = d.virtualModel.definition.stickiness;
    let stickyValue = stickiness ? d.metadata[stickiness.metadataKey] : undefined;
    if (!stickiness || !stickyValue || !d.useCaches) return await d.select();

    let fresh = null as Selection | null;

    let { value: pinned, cached } = await stickyMemo(
      `${d.virtualModel.versionId}:${stickyValue}`,
      async setTTL => {
        fresh = await d.select();
        if (!fresh.targets.length) throw new ServiceError(noCompatibleTargetError());

        setTTL(
          fresh.trace.some(entry => entry.outcome == 'signals_unavailable')
            ? 1
            : (stickiness.ttlSeconds ?? defaultStickinessTtlSeconds)
        );

        return { ruleId: fresh.ruleId, model: fresh.targets[0]!.model };
      }
    );

    if (fresh || !cached) return fresh ?? (await d.select());

    let chosen = d.targetsOf(pinned.ruleId);
    if (!chosen) return await d.select();

    let ordered = orderTargets({
      targets: chosen.models,
      profiles: d.profiles,
      summary: d.summary,
      random: d.random
    });

    let pinnedTarget = ordered.ordered.find(target => target.model == pinned.model);
    if (!pinnedTarget) return await d.select();

    return {
      ruleId: pinned.ruleId,
      reason: 'sticky',
      trace: [],
      targets: [pinnedTarget, ...ordered.ordered.filter(target => target !== pinnedTarget)],
      skippedTargets: ordered.skipped,
      overrides: chosen.overrides
    };
  }
}

export let virtualModelRoutingService = Service.create(
  'virtualModelRoutingService',
  () => new VirtualModelRoutingServiceImpl()
).build();
