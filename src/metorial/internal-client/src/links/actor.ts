import type { Consumer, OrganizationActor } from '@metorial/db';
import {
  getConsumerActorIdentifier,
  getConsumerServiceId,
  getOrganizationActorIdentifier,
  getOrganizationActorServiceId,
  getOrganizationActorType,
  loadConsumer,
  loadOrganizationActor,
  persistConsumerLink,
  persistOrganizationActorLink
} from './shared';
import type { InternalActorLink } from './types';
import { upsertSubspaceActor, upsertSynthesisActor } from './upsert';

export let ensureSynthesisOrganizationActor = async (
  tenantId: string,
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
): Promise<InternalActorLink> => {
  let actorId = getOrganizationActorServiceId('synthesis', organizationActor);
  if (actorId) return { id: actorId };

  let loadedOrganizationActor = await loadOrganizationActor(organizationActor);
  let actorIdentifier = getOrganizationActorIdentifier(loadedOrganizationActor);
  let actor = await upsertSynthesisActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedOrganizationActor.name,
    type: getOrganizationActorType(loadedOrganizationActor),
    organizationActorId: loadedOrganizationActor.id
  });

  await persistOrganizationActorLink({
    service: 'synthesis',
    organizationActor: loadedOrganizationActor,
    actorId: actor.id,
    actorIdentifier
  });

  return actor;
};

export let ensureSubspaceOrganizationActor = async (
  tenantId: string,
  organizationActor: Pick<OrganizationActor, 'id'> & Partial<OrganizationActor>
): Promise<InternalActorLink> => {
  let actorId = getOrganizationActorServiceId('subspace', organizationActor);
  if (actorId) return { id: actorId };

  let loadedOrganizationActor = await loadOrganizationActor(organizationActor);
  let actorIdentifier = getOrganizationActorIdentifier(loadedOrganizationActor);
  let actor = await upsertSubspaceActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedOrganizationActor.name,
    organizationActorId: loadedOrganizationActor.id
  });

  await persistOrganizationActorLink({
    service: 'subspace',
    organizationActor: loadedOrganizationActor,
    actorId: actor.id,
    actorIdentifier
  });

  return actor;
};

export let ensureSynthesisConsumerActor = async (
  tenantId: string,
  consumer: Pick<Consumer, 'id'> & Partial<Consumer>
): Promise<InternalActorLink> => {
  let actorId = getConsumerServiceId('synthesis', consumer);
  if (actorId) return { id: actorId };

  let loadedConsumer = await loadConsumer(consumer);
  let actorIdentifier = getConsumerActorIdentifier(loadedConsumer);
  let actor = await upsertSynthesisActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedConsumer.name,
    type: 'external',
    consumerId: loadedConsumer.id
  });

  await persistConsumerLink({
    service: 'synthesis',
    consumer: loadedConsumer,
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
  let actor = await upsertSubspaceActor({
    tenantId,
    identifier: actorIdentifier,
    name: loadedConsumer.name,
    consumerId: loadedConsumer.id
  });

  await persistConsumerLink({
    service: 'subspace',
    consumer: loadedConsumer,
    actorId: actor.id,
    actorIdentifier
  });

  return actor;
};
