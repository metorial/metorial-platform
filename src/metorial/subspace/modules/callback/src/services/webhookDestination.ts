import { Service } from '@lowerdeck/service';
import type { CallbackDestination } from '@metorial-subspace/db';
import { type MetorialFacing, resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import {
  callbackDestinationService,
  type CreateCallbackDestinationParams,
  type ListCallbackDestinationsParams,
  type UpdateCallbackDestinationParams
} from './callbackDestination';
import { webhookEventService, type WebhookEventFilters } from './webhookEvent';

class webhookDestinationServiceImpl {
  async listWebhookDestinations(d: MetorialFacing<ListCallbackDestinationsParams>) {
    return await callbackDestinationService.listCallbackDestinations(d);
  }

  async getWebhookDestinationById(d: MetorialFacing<{ webhookDestinationId: string }>) {
    return await callbackDestinationService.getCallbackDestinationById({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestinationId: d.webhookDestinationId
    });
  }

  async createWebhookDestination(d: MetorialFacing<CreateCallbackDestinationParams>) {
    return await callbackDestinationService.createCallbackDestination(d);
  }

  async updateWebhookDestination(
    d: MetorialFacing<{
      webhookDestination: CallbackDestination;
      input: UpdateCallbackDestinationParams['input'];
    }>
  ) {
    return await callbackDestinationService.updateCallbackDestination({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestination: d.webhookDestination,
      input: d.input
    });
  }

  async archiveWebhookDestination(
    d: MetorialFacing<{ webhookDestination: CallbackDestination }>
  ) {
    return await callbackDestinationService.archiveCallbackDestination({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestination: d.webhookDestination
    });
  }

  async rotateSigningSecret(
    d: MetorialFacing<{
      webhookDestination: CallbackDestination;
    }>
  ) {
    return await callbackDestinationService.rotateSigningSecret({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestination: d.webhookDestination
    });
  }

  async enrichWebhookDestination(
    d: MetorialFacing<{
      webhookDestination: CallbackDestination;
    }>
  ) {
    return await callbackDestinationService.enrichCallbackDestination({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestination: d.webhookDestination
    });
  }

  async enrichWebhookDestinations(
    d: MetorialFacing<{
      webhookDestinations: CallbackDestination[];
    }>
  ) {
    return await callbackDestinationService.enrichCallbackDestinations({
      instance: d.instance,
      organizationActor: d.organizationActor,
      callbackDestinations: d.webhookDestinations
    });
  }

  async ensureMaterialized(
    d: MetorialFacing<{
      webhookDestination: CallbackDestination;
    }>
  ) {
    let destination = await callbackDestinationService.getCallbackDestinationById({
      instance: d.instance,
      callbackDestinationId: d.webhookDestination.id
    });
    let scope = await resolveMetorialFacing(d);
    return await callbackDestinationService.ensureMaterializedInternal({
      tenant: scope.tenant,
      callbackDestination: destination
    });
  }

  async listWebhookDestinationEvents(
    d: MetorialFacing<{
      webhookDestination: CallbackDestination;
      filters: Omit<WebhookEventFilters, 'destinationIds'>;
    }>
  ) {
    let materialized = await this.ensureMaterialized({
      instance: d.instance,
      organizationActor: d.organizationActor,
      webhookDestination: d.webhookDestination
    });
    return await webhookEventService.listWebhookEvents({
      instance: d.instance,
      organizationActor: d.organizationActor,
      filters: {
        ...d.filters,
        destinationIds: [materialized.signalEventDestinationId!]
      }
    });
  }
}

export let webhookDestinationService = Service.create(
  'webhookDestinationService',
  () => new webhookDestinationServiceImpl()
).build();
