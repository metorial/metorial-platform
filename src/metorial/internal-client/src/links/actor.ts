import type { Consumer, OrganizationActor } from '@metorial/db';
import {
  getConsumerActorIdentifier,
  getConsumerServiceId,
  getOrganizationActorIdentifier,
  getOrganizationActorServiceId,
  loadConsumer,
  loadOrganizationActor,
  persistConsumerLink,
  persistOrganizationActorLink
} from './shared';
import type { InternalActorLink } from './types';
import {
  resolveConsumerResourceActor,
  resolveOrganizationActorResourceActor
} from './resourceLink';
import { upsertSubspaceActor } from './upsert';

export let ensureSubspaceOrganizationActor = async (
  tenantId: string,
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
): Promise<InternalActorLink> => {
  let actorId = getOrganizationActorServiceId('subspace', organizationActor);
  if (actorId) return { id: actorId };

  let loadedOrganizationActor = await loadOrganizationActor(organizationActor);
  let actorIdentifier = getOrganizationActorIdentifier(loadedOrganizationActor);
  let resourceActor = await resolveOrganizationActorResourceActor({
    tenantId,
    organizationActor: loadedOrganizationActor
  });
  let actor = await upsertSubspaceActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedOrganizationActor.name,
    organizationActorId: loadedOrganizationActor.id,
    resourceActorId: resourceActor.id,
    resourceActorIdentifier: resourceActor.identifier
  });

  await persistOrganizationActorLink({
    service: 'subspace',
    organizationActor: loadedOrganizationActor,
    actorId: actor.id,
    actorIdentifier
  });

  return actor;
};

export let ensureSubspaceConsumerActor = async (
  tenantId: string,
  consumer: Pick<Consumer, 'id'> & Partial<Consumer>
): Promise<InternalActorLink> => {
  let actorId = getConsumerServiceId('subspace', consumer);
  if (actorId) return { id: actorId };

  let loadedConsumer = await loadConsumer(consumer);
  let actorIdentifier = getConsumerActorIdentifier(loadedConsumer);
  let resourceActor = await resolveConsumerResourceActor({
    tenantId,
    consumer: loadedConsumer
  });
  let actor = await upsertSubspaceActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedConsumer.name,
    consumerId: loadedConsumer.id,
    resourceActorId: resourceActor.id,
    resourceActorIdentifier: resourceActor.identifier
  });

  await persistConsumerLink({
    service: 'subspace',
    consumer: loadedConsumer,
    actorId: actor.id,
    actorIdentifier
  });

  return actor;
};
