import { reattributionEvents } from '@mtsrc/agent-tracking-events';
import { captureEvents } from '@mtsrc/agent-tracking-events/test/events';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { entityService } from '@mtsrc/agent-tracking-module-entities';
import { getStore } from '@mtsrc/agent-tracking-store';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { cleanDatabase } from '@mtsrc/agent-tracking-db/test/setup';
import { classifySession } from '../src/lib/run';
import { sessionDocument } from './fixtures';

captureEvents(reattributionEvents);

let store = getStore();

describe('classification and attribution', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await store.close();
  });

  it('turns an accepted result into a classifier attribution entry', async () => {
    let { organization, project, instance } = await createTestScope();
    let billing = await entityService.upsertEntity({
      organization,
      input: {
        kind: 'project',
        ref: 'billing',
        name: 'Billing',
        attributes: { ticketPrefixes: ['BILL'] }
      }
    });

    await store.ready();
    let sessions = store.collections().sessions;

    let key = crypto.randomUUID().replace(/-/g, '');
    await sessions.insertOne(
      sessionDocument({
        _id: key,
        rootSessionKey: key,
        organizationId: organization.id,
        projectId: project.id,
        instanceId: instance.id,
        context: {
          workspaceIds: [],
          repoIds: [],
          ticketRefs: ['BILL-9'],
          tags: [],
          pathStored: false
        }
      })
    );

    await classifySession({ sessionKey: key, reason: 'turn_completed', clef: null });

    let stored = await sessions.findOne({ _id: key });
    expect(stored?.classification?.status).toBe('accepted');
    expect(stored?.attribution?.entries).toContainEqual(
      expect.objectContaining({
        kind: 'project',
        entityId: billing.id,
        source: 'classifier',
        confidence: 0.95
      })
    );
    expect(stored?.attribution?.dimIds).toContain(billing.id);
  });
});
