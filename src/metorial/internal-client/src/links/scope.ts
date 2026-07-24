import {
  ensureSubspaceConsumerActor,
  ensureSubspaceOrganizationActor,
  ensureSynthesisConsumerActor,
  ensureSynthesisOrganizationActor
} from './actor';
import { ensureSubspaceInstanceScope, ensureSynthesisInstanceScope } from './instance';
import {
  ensureInternalProjectTenant,
  ensureSubspaceProjectTenant,
  ensureSynthesisProjectTenant
} from './project';
import type { InternalActorRef, InternalScopeOwner, InternalService } from './types';
import { ensureSynthesisUserScope } from './user';

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
        case 'synthesis':
          return await ensureSynthesisInstanceScope(d.owner.instance);
        case 'subspace':
          return await ensureSubspaceInstanceScope(d.owner.instance);
      }

      return unsupportedInternalService(d.service);

    case 'user':
      if (d.service == 'subspace') {
        return unsupportedInternalService(d.service);
      }

      return d.service == 'synthesis'
        ? await ensureSynthesisUserScope(d.owner.user)
        : unsupportedInternalService(d.service);
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
        case 'synthesis':
          return await ensureSynthesisOrganizationActor(d.tenantId, d.actor.organizationActor);
        case 'subspace':
          return await ensureSubspaceOrganizationActor(d.tenantId, d.actor.organizationActor);
      }

      return unsupportedInternalService(d.service);

    case 'consumer':
      switch (d.service) {
        case 'synthesis':
          return await ensureSynthesisConsumerActor(d.tenantId, d.actor.consumer);
        case 'subspace':
          return await ensureSubspaceConsumerActor(d.tenantId, d.actor.consumer);
      }

      return unsupportedInternalService(d.service);
  }
};

export {
  ensureInternalProjectTenant,
  ensureSubspaceProjectTenant,
  ensureSynthesisProjectTenant
};
