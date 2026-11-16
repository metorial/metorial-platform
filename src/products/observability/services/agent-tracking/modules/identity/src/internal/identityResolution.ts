import { Service } from '@lowerdeck/service';
import type { IngestPrincipal } from '@mtsrc/agent-tracking-records-model';
import { getCoordinationRedis } from '@mtsrc/agent-tracking-redis';
import type { NormalizedRecord, RecordAttribution } from '@mtsrc/agent-tracking-spec';
import { planAttribution, type AttributionField, type EntityRef } from '../lib/plan';
import { createIdentityResolver, type IdentityResolver } from '../lib/resolver';

export let clientEmailConflictWarning = 'identity_conflict:client_email';

class IdentityResolutionServiceImpl {
  private defaultResolver: IdentityResolver | undefined;

  // Stamps entity ids onto the records' attribution, creating discovered entities and their links
  // as needed. The records are mutated in place.
  async resolve(d: {
    principal: IngestPrincipal;
    records: NormalizedRecord[];
    clientIp?: string;
    at: Date;
    resolver?: IdentityResolver;
  }) {
    let { principal } = d;
    let resolver =
      d.resolver ??
      (this.defaultResolver ??= createIdentityResolver({ redis: getCoordinationRedis() }));

    let clientIp = principal.binding.deviceMode == 'ephemeral' ? d.clientIp : undefined;

    let plan = planAttribution({ principal, records: d.records, clientIp });

    let resolved = await resolver.resolveEntities({
      organizationId: principal.organization.id,
      requests: plan.requests,
      at: d.at
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

    d.records.forEach((record, index) => {
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
    await resolver.touch([...seen], d.at);

    return { records: d.records, entityIds: [...seen], links };
  }
}

export let identityResolutionService = Service.create(
  'identityResolutionService',
  () => new IdentityResolutionServiceImpl()
).build();
