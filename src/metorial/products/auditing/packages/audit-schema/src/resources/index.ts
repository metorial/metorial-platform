import { subspaceAuditResources } from '@metorial/audit-resources-subspace';
import { combineResourceSets, ResourceSetNames } from '../_lib/resource';
import { coreResources } from './core';
import { machineAccessResources } from './machine-access';
import { organizationResources } from './organization';
import { storageResources } from './storage';
import { workforceResources } from './workforce';

export let auditResources = combineResourceSets({
  ...coreResources,
  ...organizationResources,
  ...machineAccessResources,
  ...storageResources,
  ...workforceResources,
  ...subspaceAuditResources
});

export type AuditResource = typeof auditResources;

export type AuditResourceNames = ResourceSetNames<AuditResource>;

export * from '@metorial/audit-resources-subspace';
