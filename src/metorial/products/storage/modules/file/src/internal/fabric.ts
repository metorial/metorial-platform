import type { File } from '@metorial/db';
import type { CargoOwnerScope } from './ownerScope';

export let fileFabricOwnerFromScope = (scope: CargoOwnerScope, fileSize: number) => ({
  instance: 'instance' in scope ? { oid: scope.instance.oid } : undefined,
  organization: 'organization' in scope ? { oid: scope.organization.oid } : undefined,
  fileSize
});

export let fileFabricOwnerFromFile = (
  file: Pick<File, 'instanceOid' | 'organizationOid' | 'fileSize'>
) => ({
  instance: file.instanceOid != null ? { oid: file.instanceOid } : undefined,
  organization: file.organizationOid != null ? { oid: file.organizationOid } : undefined,
  fileSize: file.fileSize
});
