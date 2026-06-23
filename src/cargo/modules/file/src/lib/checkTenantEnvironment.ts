export let checkTenantEnvironment = (d: {
  tenant: { oid: bigint; id: string };
  environment: { oid: bigint; id: string };
  entity: { tenantOid: bigint; environmentOid: bigint };
  name: string;
}) => {
  if (d.entity.tenantOid !== d.tenant.oid || d.entity.environmentOid !== d.environment.oid) {
    throw new Error(`${d.name} does not belong to the active tenant environment`);
  }
};
