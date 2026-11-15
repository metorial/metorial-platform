import {
  consumerSkillManageAccessRoles,
  consumerSkillReadRoles,
  consumerSkillWriteRoles,
  consumerStoreManageAccessRoles,
  consumerStoreReadRoles,
  consumerStoreWriteRoles
} from './accessRoles';
import type { Scope } from './scopeValues';

export let storeResourceAccessLevels = ['read', 'write', 'manage'] as const;

export type StoreResourceAccessLevel = (typeof storeResourceAccessLevels)[number];

export type StoreResourceAccessPolicy = {
  name: string;
  systemIdentifier: string;
  roles: Scope[];
};

export type StoreResourceAccessDefinition = {
  kind: string;
  policies: Record<StoreResourceAccessLevel, StoreResourceAccessPolicy>;
};

export let assertDistinctStoreResourceAccessRoles = (
  access: StoreResourceAccessDefinition
) => {
  let seen = new Map<string, StoreResourceAccessLevel>();

  for (let level of storeResourceAccessLevels) {
    for (let role of access.policies[level].roles) {
      let other = seen.get(role);
      if (other) {
        throw new Error(
          `Store resource kind ${access.kind} uses role ${role} for both ${other} and ${level} access.`
        );
      }
      seen.set(role, level);
    }
  }
};

export let skillStoreResourceAccess: StoreResourceAccessDefinition = {
  kind: 'skill',
  policies: {
    read: {
      name: 'Metorial Consumer Skill Read',
      systemIdentifier: 'consumer_skill_read',
      roles: [...consumerSkillReadRoles]
    },
    write: {
      name: 'Metorial Consumer Skill Write',
      systemIdentifier: 'consumer_skill_write',
      roles: [...consumerSkillWriteRoles]
    },
    manage: {
      name: 'Metorial Consumer Skill Manage Access',
      systemIdentifier: 'consumer_skill_manage_access',
      roles: [...consumerSkillManageAccessRoles]
    }
  }
};

export let standaloneStoreResourceAccess: StoreResourceAccessDefinition = {
  kind: 'store',
  policies: {
    read: {
      name: 'Metorial Consumer Store Read',
      systemIdentifier: 'consumer_store_read',
      roles: [...consumerStoreReadRoles]
    },
    write: {
      name: 'Metorial Consumer Store Write',
      systemIdentifier: 'consumer_store_write',
      roles: [...consumerStoreWriteRoles]
    },
    manage: {
      name: 'Metorial Consumer Store Manage Access',
      systemIdentifier: 'consumer_store_manage_access',
      roles: [...consumerStoreManageAccessRoles]
    }
  }
};

assertDistinctStoreResourceAccessRoles(skillStoreResourceAccess);
assertDistinctStoreResourceAccessRoles(standaloneStoreResourceAccess);

export let getImpliedStoreResourceAccessLevels = (level: StoreResourceAccessLevel) =>
  storeResourceAccessLevels.slice(0, storeResourceAccessLevels.indexOf(level) + 1);
