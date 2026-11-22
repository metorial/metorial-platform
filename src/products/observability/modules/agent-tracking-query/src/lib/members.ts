import { db } from '@metorial/db';
import {
  type AgentTracking,
  consumerEntitySource,
  requireAgentTracking
} from '@metorial/module-agent-tracking-sync';
import type { ReadScope } from './scope';
import { readCallOptions } from './service';
import type { AgentTrackingMember } from './types';

export let unknownMemberKey = 'unknown';

let maxMemberLookup = 100;

let lookupStatuses = ['managed', 'discovered', 'merged'] as const;

type RemoteMember = Awaited<ReturnType<AgentTracking['entity']['list']>>['items'][number];

export let unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => !!value))].sort();

let chunks = <T>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );

let placeholderMember = (id: string, name: string | null = null): AgentTrackingMember => ({
  id,
  name,
  email: null,
  emails: [],
  matched: false,
  consumer: null,
  needsReview: false
});

let listByIds = async (d: { organizationId: string; ids: string[] }) => {
  let agentTracking = requireAgentTracking();

  let pages = await Promise.all(
    chunks(d.ids, maxMemberLookup).map(ids =>
      agentTracking.entity.list(
        {
          organizationId: d.organizationId,
          kinds: ['user'],
          statuses: [...lookupStatuses],
          ids,
          limit: maxMemberLookup
        },
        readCallOptions
      )
    )
  );

  return pages.flatMap(page => page.items);
};

// A merged member keeps the id its usage is recorded under and shows the details of the member
// it was merged into.
let fetchRemoteMembers = async (d: { organizationId: string; ids: string[] }) => {
  let ids = unique(d.ids);
  if (!ids.length) return new Map<string, RemoteMember>();

  let found = await listByIds({ organizationId: d.organizationId, ids });
  let byId = new Map(found.map(member => [member.id, member]));

  let targets = unique(
    found
      .filter(member => member.status == 'merged' && member.mergedIntoId)
      .map(member => member.mergedIntoId)
      .filter(id => !byId.has(id!))
  );
  for (let target of await listByIds({ organizationId: d.organizationId, ids: targets })) {
    byId.set(target.id, target);
  }

  let resolved = new Map<string, RemoteMember>();
  for (let id of ids) {
    let member = byId.get(id);
    let target =
      member?.status == 'merged' && member.mergedIntoId
        ? byId.get(member.mergedIntoId)
        : member;
    if (target && target.status != 'merged') resolved.set(id, target);
  }

  return resolved;
};

export let resolveConsumerRefs = async (d: { organizationId: string; ids: string[] }) => {
  let resolved = await fetchRemoteMembers(d);

  return new Map(
    [...resolved.entries()]
      .filter(([, member]) => member.source == consumerEntitySource && member.ref)
      .map(([id, member]) => [id, member.ref!] as const)
  );
};

let presentMembers = async (d: {
  scope: Pick<ReadScope, 'organization' | 'instance'>;
  remote: RemoteMember[];
}) => {
  let refs = unique(
    d.remote.filter(member => member.source == consumerEntitySource).map(member => member.ref)
  );

  let consumers = refs.length
    ? await db.consumer.findMany({
        where: { organizationOid: d.scope.organization.oid, id: { in: refs } },
        include: { instanceConsumers: { where: { instanceOid: d.scope.instance.oid } } }
      })
    : [];
  let consumersById = new Map(consumers.map(consumer => [consumer.id, consumer]));

  return new Map(
    d.remote.map(member => {
      let consumer =
        member.source == consumerEntitySource && member.ref
          ? consumersById.get(member.ref)
          : undefined;
      let emails = unique(
        member.identifiers
          .filter(identifier => identifier.type == 'email')
          .map(identifier => identifier.value)
      );

      let view: AgentTrackingMember = {
        id: member.id,
        name: consumer?.name || member.name || null,
        email: consumer?.email || emails[0] || null,
        emails,
        matched: !!consumer,
        consumer: consumer
          ? {
              id: consumer.instanceConsumers[0]?.id ?? null,
              name: consumer.name,
              email: consumer.email
            }
          : null,
        needsReview: member.needsReview
      };

      return [member.id, view] as const;
    })
  );
};

export let lookupMembers = async (d: {
  scope: Pick<ReadScope, 'organization' | 'instance'>;
  ids: string[];
  names?: Map<string, string | null>;
}) => {
  let resolved = await fetchRemoteMembers({
    organizationId: d.scope.organization.id,
    ids: d.ids
  });
  let views = await presentMembers({
    scope: d.scope,
    remote: [...new Map([...resolved.values()].map(member => [member.id, member])).values()]
  });

  return new Map(
    unique(d.ids).map(id => {
      let target = resolved.get(id);
      let view = target ? views.get(target.id) : undefined;

      return [
        id,
        view ? { ...view, id } : placeholderMember(id, d.names?.get(id) ?? null)
      ] as const;
    })
  );
};
