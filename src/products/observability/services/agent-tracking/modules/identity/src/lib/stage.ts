import type { NormalizedRecord } from '@mtsrc/agent-tracking-spec';
import { contextFingerprint, sessionContextType } from '@mtsrc/agent-tracking-records-model';
import { sourceTags } from '@mtsrc/agent-tracking-records-model';
import {
  createOrganizationKeyDeriver,
  type OrganizationKeyDeriver
} from '@mtsrc/agent-tracking-crypto';
import { env } from '../env';
import type { PipelineContext, PipelineStage } from '@mtsrc/agent-tracking-module-ingest';
import { buildRecord } from '@mtsrc/agent-tracking-records-model';
import { getCoordinationRedis, redisKey } from '@mtsrc/agent-tracking-redis';
import { createIdentityResolver, type IdentityResolver } from './resolver';
import { identityResolutionService } from '../internal/identityResolution';

let sourceTagsTtlSeconds = 24 * 60 * 60;

export let sourceTagsClaimKey = (sessionKey: string, credentialId: string) =>
  redisKey('srctags', sessionKey, credentialId);

export type AttributionStageOptions = {
  resolver?: IdentityResolver;
  keys?: OrganizationKeyDeriver;
};

let sourceTagRecords = async (d: {
  context: PipelineContext;
  records: NormalizedRecord[];
  resolver: IdentityResolver;
  keys: OrganizationKeyDeriver;
}) => {
  let { principal } = d.context.request;

  let tags = sourceTags(principal.tags);
  if (!tags.length) return [];

  let sessions = new Map<string, NormalizedRecord>();
  for (let record of d.records) {
    let sessionKey = record.ctx.session_key;
    if (sessionKey && record.ctx.session_id && !sessions.has(sessionKey)) {
      sessions.set(sessionKey, record);
    }
  }

  let built: NormalizedRecord[] = [];

  for (let [sessionKey, record] of sessions) {
    let claimed = await d.resolver.claimOnce(
      sourceTagsClaimKey(sessionKey, principal.credential.id),
      sourceTagsTtlSeconds
    );
    if (!claimed) continue;

    built.push(
      buildRecord(
        {
          principal,
          organizationKey: d.keys.forOrganization(principal.organization),
          requestId: d.context.request.requestId,
          route: record.ingest.route,
          observedAt: d.context.observedAt,
          lane: d.context.lane,
          batchId: record.ingest.batch_id,
          agent: record.ingest.agent,
          arrivalIsEventTime: true
        },
        { adapter: 'metorial', dialect: 'credential', channel: record.source.channel },
        {
          kind: 'event',
          type: sessionContextType,
          identity: [
            sessionContextType,
            'credential',
            principal.credential.id,
            record.ctx.session_id,
            contextFingerprint(tags)
          ].join('|'),
          occurredAt: new Date(record.occurred_at),
          client: { ...record.client },
          ctx: { sessionId: record.ctx.session_id },
          data: { source: 'credential', tags }
        }
      )
    );
  }

  return built;
};

export let createAttributionStage = (opts: AttributionStageOptions = {}): PipelineStage => {
  let resolver: IdentityResolver | undefined = opts.resolver;
  let keys: OrganizationKeyDeriver | undefined = opts.keys;

  let resolverOf = () =>
    (resolver ??= createIdentityResolver({ redis: getCoordinationRedis() }));
  let keysOf = () => (keys ??= createOrganizationKeyDeriver(env.records.hashSecret));

  return {
    name: 'attribution',

    beforeWrite: async (context, records) => {
      let { principal } = context.request;
      let resolver = resolverOf();

      records.push(
        ...(await sourceTagRecords({ context, records, resolver, keys: keysOf() }))
      );

      await identityResolutionService.resolve({
        principal,
        records,
        clientIp: context.request.clientIp,
        at: context.observedAt,
        resolver
      });
    }
  };
};
