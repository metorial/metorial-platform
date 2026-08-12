import { Context } from '@metorial/context';

export interface AuditScope {
  resourceTenantOid: bigint;
  resourceGroupOid: bigint;
  resourceActorOid: bigint;
  context: Context;
}
