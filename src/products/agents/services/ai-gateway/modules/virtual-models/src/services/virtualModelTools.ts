import { notFoundError, preconditionFailedError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { computeCost } from '@mtsrc/ai-gateway-cost';
import { db } from '@mtsrc/ai-gateway-db';
import { routeService } from '@mtsrc/ai-gateway-module-routing';
import { summarizeRequest, type RequestDialect } from '@mtsrc/ai-gateway-request-features';
import {
  emptyUsage,
  resolveInstanceSettings,
  type GatewayPrincipal,
  type Pricing,
  type RequestMetadata,
  type SignalValues,
  type VirtualModelDefinition
} from '@mtsrc/ai-gateway-spec';
import {
  getStore,
  isStoreConfigured,
  type InferenceContentDocument,
  type InferenceLogDocument
} from '@mtsrc/ai-gateway-store';
import { createHash } from 'node:crypto';
import { allVirtualModelTemplates } from '../definitions/templates';
import { invalidDefinition, parseDefinition } from '../lib/definition';
import type { ActiveVirtualModel } from '../lib/lookup';
import {
  virtualModelService,
  type VirtualModelScope,
  type VirtualModelWithRelations
} from './virtualModel';
import { virtualModelRoutingService } from './virtualModelRouting';

let maxReplayLogs = 50;
let replayConcurrency = 4;
let maxInsightsDays = 90;
let dayMs = 24 * 60 * 60 * 1000;

let definitionHash = (definition: VirtualModelDefinition) =>
  createHash('sha256').update(JSON.stringify(definition)).digest('hex').slice(0, 24);

let activeModelOf = (
  virtualModel: VirtualModelWithRelations | null,
  definition?: VirtualModelDefinition
): ActiveVirtualModel => {
  let current = virtualModel?.currentVersion;
  let effective = definition ?? current?.definition;
  if (!effective) throw invalidDefinition('Provide a definition to test.');

  return {
    id: virtualModel?.id ?? 'draft',
    slug: virtualModel?.slug ?? 'draft',
    name: virtualModel?.name ?? 'Draft',
    description: virtualModel?.description ?? null,
    versionId: definition ? `draft_${definitionHash(definition)}` : current!.id,
    versionNumber: definition ? 0 : current!.number,
    definition: effective,
    createdAt: virtualModel?.createdAt ?? new Date()
  };
};

let signalsSignature = (definition: VirtualModelDefinition) =>
  JSON.stringify({
    model: definition.decision?.model,
    context: definition.decision?.context,
    signals: definition.signals
  });

let mapConcurrent = async <T, R>(items: T[], limit: number, map: (item: T) => Promise<R>) => {
  let results: R[] = new Array(items.length);
  let next = 0;

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        let index = next++;
        results[index] = await map(items[index]!);
      }
    })
  );

  return results;
};

let assertStore = () => {
  if (!isStoreConfigured()) {
    throw new ServiceError(
      preconditionFailedError({ message: 'The inference log store is not configured.' })
    );
  }

  return getStore();
};

class VirtualModelToolsServiceImpl {
  listTemplates() {
    return allVirtualModelTemplates;
  }

  async createFromTemplate(d: {
    scope: VirtualModelScope;
    input: {
      templateSlug: string;
      slug: string;
      name: string;
      description?: string | null;
      models: Record<string, string>;
      decisionConnectionId?: string;
    };
  }) {
    let template = allVirtualModelTemplates.find(
      template => template.slug == d.input.templateSlug
    );
    if (!template) throw new ServiceError(notFoundError('virtual_model_template'));

    let missing = template.parameters.filter(parameter => !d.input.models[parameter.key]);
    if (missing.length) {
      throw invalidDefinition(
        `The template needs ${missing.map(parameter => parameter.key).join(', ')}.`
      );
    }

    let definition = template.build(d.input.models);
    if (definition.decision && d.input.decisionConnectionId) {
      definition.decision.connectionId = d.input.decisionConnectionId;
    }

    return await virtualModelService.createVirtualModel({
      scope: d.scope,
      input: {
        slug: d.input.slug,
        name: d.input.name,
        description: d.input.description ?? template.description,
        definition
      }
    });
  }

  // Runs a request through a saved virtual model or a draft definition without sending it to a
  // provider. The decision model is called for real (and billed), but nothing is cached or pinned.
  async testRequest(d: {
    scope: VirtualModelScope;
    virtualModel?: VirtualModelWithRelations;
    definition?: unknown;
    tokenId?: string;
    dialect: RequestDialect;
    body: unknown;
    metadata?: RequestMetadata;
  }) {
    let definition =
      d.definition === undefined
        ? undefined
        : (
            await virtualModelService.validateDefinition({
              scope: d.scope,
              definition: d.definition
            })
          ).definition;

    let summary = summarizeRequest(d.dialect, d.body);

    let route = await virtualModelRoutingService.routeVirtual({
      principal: await this.principalFor({ scope: d.scope, tokenId: d.tokenId }),
      virtualModel: activeModelOf(d.virtualModel ?? null, definition),
      summary,
      metadata: d.metadata ?? {},
      useCaches: false
    });

    return { summary, route };
  }

  // Re-routes logged requests through the current definition or a draft and reports what would
  // change. Logged signals are reused when the decision setup is unchanged, so most replays don't
  // call the decision model at all.
  async replay(d: {
    scope: VirtualModelScope;
    virtualModel: VirtualModelWithRelations;
    definition?: unknown;
    limit?: number;
  }) {
    let store = assertStore();
    await store.ready();

    let definition = d.definition === undefined ? undefined : parseDefinition(d.definition);
    if (definition) {
      await virtualModelService.validateDefinition({
        scope: d.scope,
        definition,
        slug: d.virtualModel.slug
      });
    }

    let active = activeModelOf(d.virtualModel, definition);
    let principal = await this.principalFor({ scope: d.scope });
    let limit = Math.min(Math.max(d.limit ?? 20, 1), maxReplayLogs);

    let logs = await store.inferenceLogs
      .find({
        instanceId: d.scope.instance.id,
        'virtualModel.id': d.virtualModel.id,
        hasContent: true
      })
      .sort({ _id: -1 })
      .limit(limit)
      .lean<InferenceLogDocument[]>();

    let contents = new Map(
      (
        await store.inferenceContents
          .find({ _id: { $in: logs.map(log => log._id) }, instanceId: d.scope.instance.id })
          .lean<InferenceContentDocument[]>()
      ).map(content => [content._id, content])
    );

    let versionSignatures = new Map(
      (
        await db.virtualModelVersion.findMany({
          where: {
            virtualModelOid: d.virtualModel.oid,
            id: { in: [...new Set(logs.map(log => log.virtualModel!.versionId))] }
          },
          select: { id: true, definition: true }
        })
      ).map(version => [version.id, signalsSignature(version.definition)])
    );
    let activeSignature = signalsSignature(active.definition);

    let results = await mapConcurrent(
      logs.filter(log => contents.has(log._id)),
      replayConcurrency,
      async log => {
        let original = log.virtualModel!;
        let reusable =
          original.decision?.signals &&
          versionSignatures.get(original.versionId) == activeSignature
            ? (original.decision.signals as SignalValues)
            : undefined;

        try {
          let route = await virtualModelRoutingService.routeVirtual({
            principal,
            virtualModel: active,
            summary: summarizeRequest(log.dialect, contents.get(log._id)!.request),
            metadata: log.metadata ?? {},
            useCaches: false,
            resolveCandidates: false,
            presetSignals: reusable,
            random: () => 0.5,
            now: log.timing.receivedAt
          });
          let replayed = route.virtualModel!;

          return {
            logId: log._id,
            receivedAt: log.timing.receivedAt,
            original: {
              ruleId: original.ruleId,
              model: log.model?.slug ?? original.targets[0] ?? null
            },
            replayed: {
              ruleId: replayed.ruleId,
              model: replayed.targets[0] ?? null,
              trace: replayed.trace,
              decision: replayed.decision
            },
            changed:
              original.ruleId != replayed.ruleId ||
              (original.targets[0] ?? null) != (replayed.targets[0] ?? null),
            error: null
          };
        } catch (error) {
          return {
            logId: log._id,
            receivedAt: log.timing.receivedAt,
            original: { ruleId: original.ruleId, model: log.model?.slug ?? null },
            replayed: null,
            changed: true,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }
    );

    return {
      results,
      summary: {
        replayed: results.length,
        changed: results.filter(result => result.changed).length,
        decisionCostUsd: results.reduce(
          (sum, result) => sum + (result.replayed?.decision?.costUsd ?? 0),
          0
        )
      }
    };
  }

  async insights(d: {
    scope: VirtualModelScope;
    virtualModel: VirtualModelWithRelations;
    days?: number;
    baselineModel?: string;
  }) {
    let store = assertStore();
    await store.ready();

    let days = Math.min(Math.max(d.days ?? 7, 1), maxInsightsDays);
    let since = new Date(Date.now() - days * dayMs);
    let match = {
      instanceId: d.scope.instance.id,
      'virtualModel.id': d.virtualModel.id,
      'timing.receivedAt': { $gte: since }
    };

    let [routes, decisions, usage] = await Promise.all([
      store.inferenceLogs.aggregate<{
        _id: { ruleId: string | null; model: string | null };
        requests: number;
        failed: number;
        billedUsd: number;
        inputTokens: number;
        outputTokens: number;
        avgTotalMs: number;
      }>([
        { $match: match },
        {
          $group: {
            _id: { ruleId: '$virtualModel.ruleId', model: '$model.slug' },
            requests: { $sum: 1 },
            failed: { $sum: { $cond: [{ $eq: ['$status', 'succeeded'] }, 0, 1] } },
            billedUsd: { $sum: { $ifNull: ['$billedCost.totalUsd', 0] } },
            inputTokens: { $sum: { $ifNull: ['$usage.input.total', 0] } },
            outputTokens: { $sum: { $ifNull: ['$usage.output.total', 0] } },
            avgTotalMs: { $avg: '$timing.totalMs' }
          }
        },
        { $sort: { requests: -1 } }
      ]),

      store.inferenceLogs.aggregate<{
        _id: null;
        calls: number;
        cached: number;
        failed: number;
        costUsd: number;
        avgLatencyMs: number;
      }>([
        { $match: { ...match, 'virtualModel.decision': { $type: 'object' } } },
        {
          $group: {
            _id: null,
            calls: { $sum: 1 },
            cached: { $sum: { $cond: ['$virtualModel.decision.cached', 1, 0] } },
            failed: {
              $sum: {
                $cond: [{ $eq: [{ $type: '$virtualModel.decision.error' }, 'object'] }, 1, 0]
              }
            },
            costUsd: { $sum: '$virtualModel.decision.costUsd' },
            avgLatencyMs: { $avg: '$virtualModel.decision.latencyMs' }
          }
        }
      ]),

      store.inferenceLogs.aggregate<{
        _id: null;
        noCache: number;
        cacheRead: number;
        cacheWrite: number;
        text: number;
        reasoning: number;
      }>([
        { $match: { ...match, status: 'succeeded', usage: { $type: 'object' } } },
        {
          $group: {
            _id: null,
            noCache: { $sum: '$usage.input.noCache' },
            cacheRead: { $sum: '$usage.input.cacheRead' },
            cacheWrite: { $sum: '$usage.input.cacheWrite' },
            text: { $sum: '$usage.output.text' },
            reasoning: { $sum: '$usage.output.reasoning' }
          }
        }
      ])
    ]);

    let decision = decisions[0] ?? {
      calls: 0,
      cached: 0,
      failed: 0,
      costUsd: 0,
      avgLatencyMs: 0
    };
    let billedUsd = routes.reduce((sum, route) => sum + route.billedUsd, 0);

    return {
      since,
      days,
      routes: routes.map(route => ({
        ruleId: route._id.ruleId,
        model: route._id.model,
        requests: route.requests,
        failed: route.failed,
        billedUsd: route.billedUsd,
        inputTokens: route.inputTokens,
        outputTokens: route.outputTokens,
        avgTotalMs: route.avgTotalMs
      })),
      decision: {
        calls: decision.calls,
        cached: decision.cached,
        failed: decision.failed,
        costUsd: decision.costUsd,
        avgLatencyMs: decision.avgLatencyMs
      },
      billedUsd,
      savings: d.baselineModel
        ? await this.savingsAgainst({
            baselineModel: d.baselineModel,
            usage: usage[0],
            spentUsd: billedUsd + decision.costUsd
          })
        : null
    };
  }

  // An estimate: the summed token usage priced at the baseline model's cheapest offering, ignoring
  // context-size tiers, compared with what was billed plus what the decision model cost.
  private async savingsAgainst(d: {
    baselineModel: string;
    usage?: {
      noCache: number;
      cacheRead: number;
      cacheWrite: number;
      text: number;
      reasoning: number;
    };
    spentUsd: number;
  }) {
    let resolved = await routeService.resolveModel({ model: d.baselineModel });
    let offerings = await db.modelOffering.findMany({
      where: { model: { slug: resolved.model.slug }, removedAt: null },
      select: { pricing: true }
    });

    let pricing = offerings
      .map(offering => offering.pricing)
      .filter((pricing): pricing is Pricing => !!pricing?.text)
      .sort((a, b) => (a.text!.input ?? Infinity) - (b.text!.input ?? Infinity))[0];
    if (!pricing) return null;

    let usage = emptyUsage();
    usage.input.noCache = d.usage?.noCache ?? 0;
    usage.input.cacheRead = d.usage?.cacheRead ?? 0;
    usage.input.cacheWrite = d.usage?.cacheWrite ?? 0;
    usage.output.text = d.usage?.text ?? 0;
    usage.output.reasoning = d.usage?.reasoning ?? 0;

    let baseline = computeCost({ pricing: { ...pricing, contextTiers: [] }, usage });

    return {
      baselineModel: resolved.model.slug,
      baselineUsd: baseline.totalUsd,
      spentUsd: d.spentUsd,
      savedUsd: baseline.totalUsd - d.spentUsd,
      priced: baseline.priced
    };
  }

  private async principalFor(d: {
    scope: VirtualModelScope;
    tokenId?: string;
  }): Promise<GatewayPrincipal> {
    let instance = await db.instance.findUniqueOrThrow({
      where: { oid: d.scope.instance.oid },
      include: { project: true }
    });

    let token = d.tokenId
      ? await db.gatewayToken.findFirst({
          where: { id: d.tokenId, instanceOid: instance.oid }
        })
      : null;
    if (d.tokenId && !token) throw new ServiceError(notFoundError('gateway_token'));

    return {
      token: token
        ? {
            id: token.id,
            consumerRef: token.consumerRef,
            allowedModels: token.allowedModels,
            limits: token.limits,
            metadata: token.metadata
          }
        : { id: 'test', consumerRef: null, allowedModels: [], limits: [], metadata: {} },
      organization: { id: d.scope.organization.id, ref: d.scope.organization.ref },
      project: {
        id: instance.project.id,
        ref: instance.project.ref,
        platformLimits: instance.project.platformLimits,
        disabled: null,
        billingRestriction: instance.project.billingRestrictedAt
          ? { reason: instance.project.billingRestrictionReason }
          : null
      },
      instance: {
        id: instance.id,
        ref: instance.ref,
        logRetentionDays: instance.logRetentionDays,
        settings: resolveInstanceSettings(instance.settings),
        limits: instance.limits
      }
    };
  }
}

export let virtualModelToolsService = Service.create(
  'virtualModelToolsService',
  () => new VirtualModelToolsServiceImpl()
).build();
