import { notFoundError, ServiceError } from '@mtsrc/error';
import { ensureCargoScope, resolveCargoScopeDescriptorForOwner } from '../cargo';
import type { FileOwner } from './file';

export let resolveCargoScopeForOwner = async (owner: FileOwner) => {
  let descriptor = await resolveCargoScopeDescriptorForOwner(owner);
  if (!descriptor) {
    throw new ServiceError(
      notFoundError(
        'file.scope',
        owner.type === 'user' ? owner.user.id : owner.organization.id
      )
    );
  }

  return await ensureCargoScope(descriptor);
};
