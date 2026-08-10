import { ensureSubspaceConsumerActor, ensureSubspaceOrganizationActor } from './actor';
import { ensureSubspaceInstanceScope } from './instance';
import { ensureInternalProjectTenant, ensureSubspaceProjectTenant } from './project';
import type { InternalActorRef, InternalScopeOwner, InternalService } from './types';

let unsupportedInternalService = (service: never | string): never => {
  throw new Error(`unsupported internal service: ${service}`);
};

export let ensureInternalScope = async (d: {
  service: InternalService;
  owner: InternalScopeOwner;
}) => {
  switch (d.owner.type) {
    case 'instance':
      switch (d.service) {
        case 'subspace':
          return await ensureSubspaceInstanceScope(d.owner.instance);
        case 'nebula':
          return unsupportedInternalService(d.service);
      }

      return unsupportedInternalService(d.service);

    case 'user':
      return unsupportedInternalService(d.service);
  }
};

export let ensureInternalActor = async (d: {
  service: InternalService;
  tenantId: string;
  actor: InternalActorRef;
}) => {
  switch (d.actor.type) {
    case 'organizationActor':
      switch (d.service) {
        case 'subspace':
          return await ensureSubspaceOrganizationActor(d.tenantId, d.actor.organizationActor);
        case 'nebula':
          return unsupportedInternalService(d.service);
      }

      return unsupportedInternalService(d.service);

    case 'consumer':
      switch (d.service) {
        case 'subspace':
          return await ensureSubspaceConsumerActor(d.tenantId, d.actor.consumer);
        case 'nebula':
          return unsupportedInternalService(d.service);
      }

      return unsupportedInternalService(d.service);
  }
};

export { ensureInternalProjectTenant, ensureSubspaceProjectTenant };
