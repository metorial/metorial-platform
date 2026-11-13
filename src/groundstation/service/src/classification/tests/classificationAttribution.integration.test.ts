import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { entityService } from '../../services';
import { getStore } from '../../store/connection';
import { createTestScope } from '../../test/scope';
import { cleanDatabase } from '../../test/setup';
import { classifySession } from '../run';
import { sessionDocument } from './fixtures';

vi.mock('../../attribution/reattribute', () => ({
  requestReattribution: vi.fn(async () => {})
}));

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
