import type { ProviderEventBase } from '@metorial/fabric';
import { metorialDb } from './metorialDb';
import { getSubspaceSystemAuditScope } from './systemAuditScope';

export let getSubspaceSystemProviderEventBase = async (d: {
  job: string;
  instanceOid: bigint | null;
  metadata?: Record<string, string | number | boolean | null>;
}): Promise<ProviderEventBase> => {
  if (d.instanceOid == null) {
    throw new Error(`Cannot create provider Fabric event without an instance`);
  }
  let instance = await metorialDb.instance.findUniqueOrThrow({
    where: { oid: d.instanceOid }
  });
  let auditScope = await getSubspaceSystemAuditScope(d);

  return { instance, auditScope: auditScope ?? undefined };
};
