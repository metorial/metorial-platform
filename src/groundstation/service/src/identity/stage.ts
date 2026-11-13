import type { NormalizedRecord, RecordAttribution } from '@metorial/groundstation-spec';
import { contextFingerprint, sessionContextType } from '../context/record';
import { sourceTags } from '../context/tags';
import { createOrganizationKeyDeriver, type OrganizationKeyDeriver } from '../crypto/keys';
import { env } from '../env';
import type { PipelineContext, PipelineStage } from '../pipeline/types';
import { buildRecord } from '../records/builder';
import { clientIpOf } from './clientIp';
import { planAttribution, type AttributionField, type EntityRef } from './plan';
import { getIdentityRedis } from './redis';
import { createIdentityResolver, type IdentityResolver } from './resolver';

let sourceTagsTtlSeconds = 24 * 60 * 60;

export let clientEmailConflictWarning = 'identity_conflict:client_email';

export let sourceTagsClaimKey = (sessionKey: string, credentialId: string) =>
  `gs:srctags:${sessionKey}:${credentialId}`;

export type AttributionStageOptions = {
  resolver?: IdentityResolver;
  keys?: OrganizationKeyDeriver;
  trustedProxyHops?: number;
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

  let resolverOf = () => (resolver ??= createIdentityResolver({ redis: getIdentityRedis() }));
  let keysOf = () => (keys ??= createOrganizationKeyDeriver(env.records.hashSecret));

  return {
    name: 'attribution',

    beforeWrite: async (context, records) => {
      let { principal } = context.request;
      let resolver = resolverOf();

      records.push(
        ...(await sourceTagRecords({ context, records, resolver, keys: keysOf() }))
      );

      let clientIp =
        principal.binding.deviceMode == 'ephemeral'
          ? clientIpOf({
              forwardedFor: context.request.raw.headers.get('x-forwarded-for'),
              remoteAddress: context.request.remoteAddress,
              trustedHops: opts.trustedProxyHops ?? env.ingest.trustedProxyHops
            })
          : undefined;

      let plan = planAttribution({ principal, records, clientIp });

      let resolved = await resolver.resolveEntities({
        organizationId: principal.organization.id,
        requests: plan.requests,
        at: context.observedAt
      });

      let idOf = (ref: EntityRef | undefined) =>
        !ref ? undefined : 'id' in ref ? ref.id : resolved.get(ref.request);

      let tokenUserId = principal.binding.userId;
      let tokenUserEmails =
        tokenUserId && plan.records.some(entry => entry.clientEmail)
          ? ((
              await resolver.userEmails({
                organizationId: principal.organization.id,
                userIds: [tokenUserId]
              })
            ).get(tokenUserId) ?? [])
          : [];

      let seen = new Set<string>();

      records.forEach((record, index) => {
        let entry = plan.records[index]!;
        let attribution: RecordAttribution = {};

        for (let [field, ref] of Object.entries(entry.slots) as [
          AttributionField,
          EntityRef
        ][]) {
          let id = idOf(ref);
          if (!id) continue;

          attribution[field] = id;
          seen.add(id);
        }

        if (Object.keys(attribution).length) record.attribution = attribution;

        let conflicts =
          entry.clientEmail &&
          tokenUserEmails.length &&
          !tokenUserEmails.includes(entry.clientEmail);

        if (conflicts && !record.quality.warnings.includes(clientEmailConflictWarning)) {
          record.quality.warnings.push(clientEmailConflictWarning);
        }
      });

      let links = plan.links.flatMap(link => {
        let fromId = idOf(link.from);
        let toId = idOf(link.to);

        return fromId && toId && fromId != toId ? [{ fromId, toId, type: link.type }] : [];
      });

      await resolver.ensureLinks({ organizationId: principal.organization.id, links });
      await resolver.touch([...seen], context.observedAt);
    }
  };
};
