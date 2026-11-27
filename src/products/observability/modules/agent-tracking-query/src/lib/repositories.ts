import { listEntitiesByIds, unique } from './entities';
import type { ReadScope } from './scope';
import type { AgentTrackingRepository } from './types';
import { repositoryHost, repositoryUrl, splitRepository } from './urls';

let lookupStatuses = ['managed', 'discovered', 'merged', 'archived'] as const;

let text = (value: unknown) => (typeof value == 'string' && value ? value : null);

let placeholderRepository = (id: string): AgentTrackingRepository => ({
  id,
  provider: null,
  host: null,
  owner: null,
  name: null,
  url: null
});

let repositoryOf = (entity: {
  id: string;
  name: string | null;
  attributes: unknown;
}): AgentTrackingRepository => {
  let attributes = (entity.attributes ?? {}) as Record<string, unknown>;
  let fullName = text(entity.name);
  let parts = fullName ? splitRepository(fullName) : null;

  let provider = text(attributes.provider);
  let owner = text(attributes.owner) ?? parts?.owner ?? null;
  let name = text(attributes.name) ?? parts?.name ?? fullName;

  return {
    id: entity.id,
    provider,
    host: repositoryHost(provider),
    owner,
    name,
    url: repositoryUrl({ provider, owner, name })
  };
};

export let lookupRepositories = async (d: {
  scope: Pick<ReadScope, 'organization'>;
  ids: (string | null | undefined)[];
}) => {
  let ids = unique(d.ids);
  if (!ids.length) return new Map<string, AgentTrackingRepository>();

  let entities = await listEntitiesByIds({
    organizationId: d.scope.organization.id,
    kind: 'repo',
    statuses: [...lookupStatuses],
    ids
  });
  let found = new Map(entities.map(entity => [entity.id, repositoryOf(entity)] as const));

  return new Map(ids.map(id => [id, found.get(id) ?? placeholderRepository(id)] as const));
};
