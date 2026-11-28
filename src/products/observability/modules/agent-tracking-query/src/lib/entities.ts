import {
  type AgentTracking,
  requireAgentTracking
} from '@metorial/module-agent-tracking-sync';
import { readCallOptions } from './service';

let maxEntityLookup = 100;

type EntityListInput = Parameters<AgentTracking['entity']['list']>[0];

export let unique = (values: (string | null | undefined)[]) =>
  [...new Set(values.filter((value): value is string => !!value))].sort();

export let chunks = <T>(values: T[], size: number) =>
  Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size)
  );

export let listEntitiesByIds = async (d: {
  organizationId: string;
  kind: NonNullable<EntityListInput['kinds']>[number];
  statuses: NonNullable<EntityListInput['statuses']>;
  ids: string[];
}) => {
  let agentTracking = requireAgentTracking();

  let pages = await Promise.all(
    chunks(d.ids, maxEntityLookup).map(ids =>
      agentTracking.entity.list(
        {
          organizationId: d.organizationId,
          kinds: [d.kind],
          statuses: d.statuses,
          ids,
          limit: maxEntityLookup
        },
        readCallOptions
      )
    )
  );

  return pages.flatMap(page => page.items);
};
