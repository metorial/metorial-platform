import { db, type Instance, type Organization } from '@metorial/db';
import { deviceEntitySource } from '@metorial/module-agent-tracking-sync';
import { listEntitiesByIds, unique } from './entities';
import type { AgentTrackingSkill } from './types';

let deviceLookupStatuses = ['managed', 'discovered', 'merged'] as const;

export type SkillReadScope = {
  organization: Pick<Organization, 'id'>;
  instance: Pick<Instance, 'oid'>;
  canReadSkills?: boolean;
};

let mappingKey = (consumerDeviceId: string, name: string) => `${consumerDeviceId}\n${name}`;

let consumerDeviceIdsOf = async (d: { scope: SkillReadScope; deviceIds: string[] }) => {
  let entities = await listEntitiesByIds({
    organizationId: d.scope.organization.id,
    kind: 'device',
    statuses: [...deviceLookupStatuses],
    ids: d.deviceIds
  });

  return new Map(
    entities.flatMap(entity =>
      entity.source == deviceEntitySource && entity.ref
        ? [[entity.id, entity.ref] as const]
        : []
    )
  );
};

export let lookupSkills = async (d: {
  scope: SkillReadScope;
  devicesByName: Map<string, Set<string>>;
}) => {
  let found = new Map<string, AgentTrackingSkill>();
  if (!d.devicesByName.size || !d.scope.canReadSkills) return found;

  let consumerDeviceIds = await consumerDeviceIdsOf({
    scope: d.scope,
    deviceIds: unique([...d.devicesByName.values()].flatMap(devices => [...devices]))
  });

  let candidates = [...d.devicesByName].flatMap(([name, devices]) => {
    let ids = [...devices].map(device => consumerDeviceIds.get(device));
    return ids.every(id => id !== undefined)
      ? [{ name, consumerDeviceIds: ids as string[] }]
      : [];
  });
  if (!candidates.length) return found;

  let installed = await db.consumerDeviceSkill.findMany({
    where: {
      instanceOid: d.scope.instance.oid,
      name: { in: candidates.map(candidate => candidate.name) },
      consumerDevice: {
        id: { in: unique(candidates.flatMap(candidate => candidate.consumerDeviceIds)) },
        status: 'active'
      },
      skill: { status: 'active' }
    },
    select: { name: true, skillOid: true, consumerDevice: { select: { id: true } } }
  });
  let skillOidByMapping = new Map(
    installed.map(row => [mappingKey(row.consumerDevice.id, row.name), row.skillOid])
  );

  let resolved = candidates.flatMap(candidate => {
    let oids = new Set(
      candidate.consumerDeviceIds.map(id =>
        skillOidByMapping.get(mappingKey(id, candidate.name))
      )
    );
    let [oid] = [...oids];
    return oids.size == 1 && oid !== undefined ? [[candidate.name, oid] as const] : [];
  });
  if (!resolved.length) return found;

  let skills = await db.skill.findMany({
    where: {
      oid: { in: [...new Set(resolved.map(([, oid]) => oid))] },
      instanceOid: d.scope.instance.oid,
      status: 'active'
    }
  });
  let skillsByOid = new Map(skills.map(skill => [skill.oid, skill]));

  for (let [name, oid] of resolved) {
    let skill = skillsByOid.get(oid);
    if (skill) found.set(name, { id: skill.id, name: skill.name });
  }

  return found;
};
