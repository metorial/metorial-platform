import { combineResourceSets, ResourceSetNames } from '../_lib/resource';
import { coreResources } from './core';

export let auditResources = combineResourceSets(coreResources);

export type AuditResource = typeof auditResources;

export type AuditResourceNames = ResourceSetNames<AuditResource>;
