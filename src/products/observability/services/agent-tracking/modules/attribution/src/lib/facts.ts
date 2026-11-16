import type { SessionFacts } from '@mtsrc/agent-tracking-rule-match';
import type { AttributionEntity, AttributionSession } from './types';

let remoteIdentifierTypes = (type: string) => type == 'remote' || type.startsWith('remote:');

let entityValues = (entity: AttributionEntity | undefined, id: string) => [
  id,
  ...(entity?.slug ? [entity.slug] : []),
  ...(entity?.identifiers.map(identifier => identifier.value) ?? [])
];

let valuesOf = (ids: (string | undefined)[], entities: Map<string, AttributionEntity>) =>
  ids.filter((id): id is string => !!id).flatMap(id => entityValues(entities.get(id), id));

let repoOwners = (repoIds: string[], entities: Map<string, AttributionEntity>) =>
  repoIds.flatMap(id =>
    (entities.get(id)?.identifiers ?? [])
      .filter(identifier => remoteIdentifierTypes(identifier.type))
      .flatMap(identifier => {
        let [provider, owner] = identifier.value.split('/');
        return provider && owner ? [owner, `${provider}/${owner}`] : [];
      })
  );

let unique = (values: string[]) => [...new Set(values.filter(value => value.length))];

// The view rules are evaluated against (07 §6.1). Entity fields carry the entity id, its slug
// and its identifier values, so a rule can say `user glob *@acme.com` or `repo eq aten_…`.
export let buildSessionFacts = (d: {
  session: AttributionSession;
  entities: Map<string, AttributionEntity>;
  teamIds: string[];
}): SessionFacts => {
  let { session, entities } = d;

  let facts: SessionFacts = {
    user: unique(valuesOf([session.observed.userId], entities)),
    device: unique(valuesOf([session.observed.deviceId], entities)),
    agent: unique(valuesOf([session.observed.agentId], entities)),
    team: unique(valuesOf(d.teamIds, entities)),
    repo: unique(valuesOf(session.context.repoIds, entities)),
    'repo.owner': unique(repoOwners(session.context.repoIds, entities)),
    branch: unique(session.context.branch ? [session.context.branch] : []),
    workspace: unique(valuesOf(session.context.workspaceIds, entities)),
    ticket: unique(session.context.ticketRefs),
    'client.family': unique([session.client.family]),
    'client.surface': unique(session.client.surface ? [session.client.surface] : []),
    model: unique(session.models ?? []),
    'mcp.server': unique(session.mcpServers ?? []),
    project: [session.projectId],
    instance: [session.instanceId]
  };

  for (let tag of session.context.tags) {
    let field = `tag.${tag.k.toLowerCase()}`;
    facts[field] = unique([...(facts[field] ?? []), tag.v]);
  }

  return facts;
};
