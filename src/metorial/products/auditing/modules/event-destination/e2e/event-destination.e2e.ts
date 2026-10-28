import { firstPage, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { eventDestinationListenerService, eventDestinationService } from '../src';

describe('module-event-destination', () => {
  let org = useOrganization();

  it('creates, updates, rotates and archives a webhook event destination', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let name = uniqueId('destination');
    let url = `https://example.com/webhooks/${uniqueId('hook')}`;

    let created = await eventDestinationService.createEventDestination({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        name,
        type: 'webhook',
        webhook: { url },
        retry: { strategy: 'linear', maxAttempts: 3 }
      }
    });
    expect(created).toMatchObject({
      name,
      status: 'active',
      type: 'webhook',
      retryStrategy: 'linear',
      retryMaxAttempts: 3
    });
    expect(created.webhookDestination?.url).toBe(url);

    let fetched = await eventDestinationService.getEventDestinationById({
      organization: fixture.organization,
      eventDestinationId: created.id
    });
    expect(fetched.id).toBe(created.id);

    let active = await firstPage(
      await eventDestinationService.listEventDestinations({
        organization: fixture.organization
      })
    );
    expect(active.map(item => item.id)).toContain(created.id);

    let updatedUrl = `${url}/v2`;
    let updated = await eventDestinationService.updateEventDestination({
      organization: fixture.organization,
      eventDestination: fetched,
      auditScope: fixture.auditScope,
      input: {
        name: `${name}-renamed`,
        webhook: { url: updatedUrl },
        retry: { maxAttempts: 5 }
      }
    });
    expect(updated).toMatchObject({ name: `${name}-renamed`, retryMaxAttempts: 5 });
    expect(updated.webhookDestination?.url).toBe(updatedUrl);

    let rotated = await eventDestinationService.rotateWebhookSecret({
      organization: fixture.organization,
      eventDestination: updated,
      auditScope: fixture.auditScope
    });
    expect(rotated.signingSecret).not.toBe(updated.webhookDestination?.signingSecret);
    expect(rotated.eventDestination.webhookDestination?.signingSecret).toBe(
      rotated.signingSecret
    );

    let archived = await eventDestinationService.archiveEventDestination({
      organization: fixture.organization,
      eventDestination: rotated.eventDestination,
      auditScope: fixture.auditScope
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);

    let activeAfterArchive = await firstPage(
      await eventDestinationService.listEventDestinations({
        organization: fixture.organization
      })
    );
    expect(activeAfterArchive.map(item => item.id)).not.toContain(created.id);

    let archivedList = await firstPage(
      await eventDestinationService.listEventDestinations({
        organization: fixture.organization,
        statuses: ['archived']
      })
    );
    expect(archivedList.map(item => item.id)).toContain(created.id);

    await expect(
      eventDestinationService.updateEventDestination({
        organization: fixture.organization,
        eventDestination: archived,
        auditScope: fixture.auditScope,
        input: { name: 'not-allowed' }
      })
    ).rejects.toThrow();
  });

  it('rejects destinations pointing at private addresses or with invalid retry settings', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    await expect(
      eventDestinationService.createEventDestination({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          name: uniqueId('destination'),
          type: 'webhook',
          webhook: { url: 'http://127.0.0.1/hook' }
        }
      })
    ).rejects.toThrow();

    await expect(
      eventDestinationService.createEventDestination({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: {
          name: uniqueId('destination'),
          type: 'webhook',
          webhook: { url: 'https://example.com/hook' },
          retry: { maxAttempts: 0 }
        }
      })
    ).rejects.toThrow();
  });

  it('manages event listeners on an instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);

    let destination = await eventDestinationService.createEventDestination({
      organization: fixture.organization,
      auditScope: fixture.auditScope,
      input: {
        name: uniqueId('destination'),
        type: 'webhook',
        webhook: { url: `https://example.com/webhooks/${uniqueId('hook')}` }
      }
    });

    let listener = await eventDestinationListenerService.createEventDestinationListener({
      instance: fixture.instance,
      auditScope: fixture.auditScope,
      input: {
        eventDestinationId: destination.id,
        type: 'event',
        eventTypes: ['organization.created']
      }
    });
    expect(listener).toMatchObject({ type: 'event', eventTypes: ['organization.created'] });
    expect(listener.instance.id).toBe(org.ids.instanceId);
    expect(listener.eventDestination.id).toBe(destination.id);

    let listeners = await firstPage(
      await eventDestinationListenerService.listEventDestinationListeners({
        organization: fixture.organization,
        eventDestinationIds: [destination.id],
        types: ['event']
      })
    );
    expect(listeners.map(item => item.id)).toEqual([listener.id]);

    let fetched = await eventDestinationListenerService.getEventDestinationListenerById({
      organization: fixture.organization,
      eventDestinationListenerId: listener.id
    });
    expect(fetched.id).toBe(listener.id);

    let updated = await eventDestinationListenerService.updateEventDestinationListener({
      instance: fixture.instance,
      listener: fetched,
      auditScope: fixture.auditScope,
      input: { eventTypes: [] }
    });
    expect(updated.eventTypes).toEqual([]);

    await expect(
      eventDestinationListenerService.createEventDestinationListener({
        instance: fixture.instance,
        auditScope: fixture.auditScope,
        input: {
          eventDestinationId: destination.id,
          type: 'event',
          eventTypes: ['e2e.not_a_real_event']
        }
      })
    ).rejects.toThrow();

    await eventDestinationListenerService.deleteEventDestinationListener({
      instance: fixture.instance,
      listener: updated,
      auditScope: fixture.auditScope
    });

    await expect(
      eventDestinationListenerService.getEventDestinationListenerById({
        organization: fixture.organization,
        eventDestinationListenerId: listener.id
      })
    ).rejects.toThrow();
  });
});
