import { combineResourceSets, ResourceSetNames } from '../_lib/resource';
import { coreResources } from './core';
import { machineAccessResources } from './machine-access';
import { organizationResources } from './organization';

export let auditResources = combineResourceSets({
  ...coreResources,
  ...organizationResources,
  ...machineAccessResources
});

export type AuditResource = typeof auditResources;

export type AuditResourceNames = ResourceSetNames<AuditResource>;
