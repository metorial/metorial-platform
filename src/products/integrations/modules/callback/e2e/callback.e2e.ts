import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  callbackEventService,
  callbackInstanceService,
  callbackService,
  webhookRegistrationService
} from '../src';

describe('module-callback', () => {
  let org = useOrganization();

  it('lists no callbacks, callback instances, events or webhook registrations', async () => {
    let { instance } = await loadOrganizationFixture(org.ids);

    expect(await firstPage(await callbackService.listCallbacks({ instance }))).toEqual([]);
    expect(
      await firstPage(await callbackInstanceService.listCallbackInstances({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(await callbackEventService.listCallbackEvents({ instance }))
    ).toEqual([]);
    expect(
      await firstPage(await webhookRegistrationService.listWebhookRegistrations({ instance }))
    ).toEqual([]);
  });

  it('rejects unknown callback resources', async () => {
    let { instance, auditScope } = await loadOrganizationFixture(org.ids);

    await expect(
      callbackService.getCallbackById({ instance, callbackId: uniqueId('missing-callback') })
    ).rejects.toThrow(/could not be found/);
    await expect(
      callbackEventService.getCallbackEventById({
        instance,
        callbackEventId: uniqueId('missing-event')
      })
    ).rejects.toThrow(/could not be found/);
    await expect(
      webhookRegistrationService.getWebhookRegistrationById({
        instance,
        webhookRegistrationId: uniqueId('missing-registration')
      })
    ).rejects.toThrow(/could not be found/);

    await expect(
      webhookRegistrationService.createWebhookRegistration({
        instance,
        auditScope,
        provider: { id: uniqueId('missing-provider') },
        input: { name: 'E2E Webhook' }
      })
    ).rejects.toThrow(/could not be found/);
  });
});
