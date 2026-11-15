import { beforeEach, describe, expect, it, vi } from 'vitest';

let { present, findUnique } = vi.hoisted(() => ({
  present: vi.fn(),
  findUnique: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: {
    user: {
      findUnique
    }
  }
}));

vi.mock('@metorial/audit-schema', () => ({
  auditResources: {
    organization: {
      presenter: {
        present
      },
      actions: {
        create: true,
        update: {
          validationType: {}
        }
      }
    },
    widget: {
      presenter: undefined,
      actions: {
        create: true
      }
    }
  }
}));

import { presentStashedAuditEvent } from './present';

describe('presentStashedAuditEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    present.mockImplementation((input: unknown) => {
      return (context: unknown) => ({
        run: async () => {
          expect(context).toEqual({
            apiVersion: 'mt_2026_01_01_magnetar',
            accessType: 'event_system'
          });

          return {
            object: 'organization',
            presented: true,
            ...(typeof input === 'object' && input !== null ? input : {})
          };
        }
      });
    });
  });

  it('presents both payloads and stores only changed previous attributes', async () => {
    let event = {
      id: 'evt_1',
      organizationOid: 1n,
      instanceOid: 3n,
      organizationActorOid: 4n,
      actor: {
        type: 'org_actor',
        id: 'oac_1'
      },
      context: { ip: '127.0.0.1' },
      resource: 'organization',
      action: 'create',
      payload: { organization: { id: 'org_1', name: 'Acme' } },
      previousPayload: { organization: { id: 'org_1', name: 'Old' } },
      recordedAt: new Date('2026-08-12T10:00:00.000Z')
    };

    let presented = await presentStashedAuditEvent(event as any);

    expect(present).toHaveBeenCalledTimes(2);
    expect(presented.payload).toEqual({
      object: 'organization',
      presented: true,
      organization: { id: 'org_1', name: 'Acme' }
    });
    expect(presented.previousAttributes).toEqual({
      organization: { name: 'Old' }
    });
    expect(presented).not.toHaveProperty('previousPayload');
  });

  it('skips presentation for action-specific payloads', async () => {
    let event = {
      id: 'evt_1',
      resource: 'organization',
      action: 'update',
      payload: { name: 'Updated' }
    };

    let presented = await presentStashedAuditEvent(event as any);

    expect(present).not.toHaveBeenCalled();
    expect(presented).toEqual({
      id: 'evt_1',
      resource: 'organization',
      action: 'update',
      payload: { name: 'Updated' },
      previousAttributes: undefined
    });
  });

  it('diffs validated raw payloads for action-specific resources', async () => {
    let presented = await presentStashedAuditEvent({
      id: 'evt_1',
      resource: 'organization',
      action: 'update',
      payload: { name: 'Updated', enabled: true },
      previousPayload: { name: 'Previous', enabled: true }
    } as any);

    expect(present).not.toHaveBeenCalled();
    expect(presented.previousAttributes).toEqual({
      name: 'Previous'
    });
  });

  it('keeps raw payloads when no presenter is configured', async () => {
    let event = {
      id: 'evt_1',
      resource: 'widget',
      action: 'create',
      payload: { oid: 1n }
    };

    let presented = await presentStashedAuditEvent(event as any);

    expect(present).not.toHaveBeenCalled();
    expect(presented).toEqual({
      id: 'evt_1',
      resource: 'widget',
      action: 'create',
      payload: { oid: 1n },
      previousAttributes: undefined
    });
  });
});
