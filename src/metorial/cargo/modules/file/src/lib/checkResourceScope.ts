export let checkResourceScope = (d: {
  resourceTenant: { oid: bigint; id: string };
  resourceGroup: { oid: bigint; id: string };
  entity: { resourceTenantOid: bigint; resourceGroupOid: bigint };
  name: string;
}) => {
  if (
    d.entity.resourceTenantOid !== d.resourceTenant.oid ||
    d.entity.resourceGroupOid !== d.resourceGroup.oid
  ) {
    throw new Error(`${d.name} does not belong to the active resourceTenant resourceGroup`);
  }
};
