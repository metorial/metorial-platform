import { badRequestError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import type { CargoResourceScope } from './filePurpose';

export let resolveInstanceResourceScope = async (scope: CargoResourceScope) => {
  let instance = await db.instance.findFirst({
    where: {
      resourceTenantOid: scope.resourceTenant.oid,
      resourceGroupOid: scope.resourceGroup.oid
    },
    select: {
      oid: true,
      organizationOid: true
    }
  });

  if (!instance) {
    throw new ServiceError(
      badRequestError({
        message: 'This Cargo operation requires a ResourceGroup linked to an instance.'
      })
    );
  }

  return {
    instanceOid: instance.oid,
    organizationOid: instance.organizationOid
  };
};
