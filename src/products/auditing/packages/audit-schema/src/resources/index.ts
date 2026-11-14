import { subspaceAuditResources } from '@metorial/audit-resources-subspace';
import { combineResourceSets, ResourceSetNames } from '../_lib/resource';
import { coreResources } from './core';
import { machineAccessResources } from './machine-access';
import { organizationResources } from './organization';
import { outpostResources } from './outpost';
import { sandboxResources } from './sandbox';
import { skillResources } from './skills';
import { storageResources } from './storage';
import { workforceResources } from './workforce';

export let auditResources = combineResourceSets({
  ...coreResources,
  ...organizationResources,
  ...machineAccessResources,
  ...outpostResources,
  ...sandboxResources,
  ...skillResources,
  ...storageResources,
  ...workforceResources,
  ...subspaceAuditResources
});

export type AuditResource = typeof auditResources;

export type AuditResourceNames = ResourceSetNames<AuditResource>;

export * from '@metorial/audit-resources-subspace';
