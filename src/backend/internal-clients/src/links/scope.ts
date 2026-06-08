import {
  ensureCargoConsumerActor,
  ensureCargoOrganizationActor,
  ensureSubspaceConsumerActor,
  ensureSubspaceOrganizationActor,
  ensureSynthesisConsumerActor,
  ensureSynthesisOrganizationActor
} from './actor';
import {
  ensureCargoInstanceScope,
  ensureSubspaceInstanceScope,
  ensureSynthesisInstanceScope
} from './instance';
import { ensureCargoOrganizationScope } from './organization';
import {
  ensureCargoProjectTenant,
  ensureInternalProjectTenant,
  ensureSubspaceProjectTenant,
  ensureSynthesisProjectTenant
} from './project';
import type { InternalActorRef, InternalScopeOwner, InternalService } from './types';
import { ensureCargoUserScope, ensureSynthesisUserScope } from './user';

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
        case 'cargo':
          return await ensureCargoInstanceScope(d.owner.instance);
        case 'synthesis':
          return await ensureSynthesisInstanceScope(d.owner.instance);
        case 'subspace':
          return await ensureSubspaceInstanceScope(d.owner.instance);
      }

      return unsupportedInternalService(d.service);

    case 'organization':
      if (d.service == 'cargo') {
        return await ensureCargoOrganizationScope(d.owner.organization);
      }

      return unsupportedInternalService(d.service);

    case 'user':
      if (d.service == 'subspace') {
        return unsupportedInternalService(d.service);
      }

      return d.service == 'cargo'
        ? await ensureCargoUserScope(d.owner.user)
        : await ensureSynthesisUserScope(d.owner.user);
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
        case 'cargo':
          return await ensureCargoOrganizationActor(d.tenantId, d.actor.organizationActor);
        case 'synthesis':
          return await ensureSynthesisOrganizationActor(d.tenantId, d.actor.organizationActor);
        case 'subspace':
          return await ensureSubspaceOrganizationActor(d.tenantId, d.actor.organizationActor);
      }

      return unsupportedInternalService(d.service);

    case 'consumer':
      switch (d.service) {
        case 'cargo':
          return await ensureCargoConsumerActor(d.tenantId, d.actor.consumer);
        case 'synthesis':
          return await ensureSynthesisConsumerActor(d.tenantId, d.actor.consumer);
        case 'subspace':
          return await ensureSubspaceConsumerActor(d.tenantId, d.actor.consumer);
      }

      return unsupportedInternalService(d.service);
  }
};

export {
  ensureCargoProjectTenant,
  ensureInternalProjectTenant,
  ensureSubspaceProjectTenant,
  ensureSynthesisProjectTenant
};
