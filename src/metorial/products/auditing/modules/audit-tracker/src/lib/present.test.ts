import { beforeEach, describe, expect, it, vi } from 'vitest';

let { present } = vi.hoisted(() => ({
  present: vi.fn()
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

  it('presents payload and previousAttributes with magnetar before storage', async () => {
    let event = {
      id: 'evt_1',
      resourceTenantOid: 1n,
      resourceGroupOid: 2n,
      resourceActorOid: 3n,
      actor: {
        type: 'org_actor',
        id: 'oac_1'
      },
      context: { ip: '127.0.0.1' },
      resource: 'organization',
      action: 'create',
      payload: { organization: { id: 'org_1', name: 'Acme' } },
      previousAttributes: { organization: { id: 'org_1', name: 'Old' } },
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
      object: 'organization',
      presented: true,
      organization: { id: 'org_1', name: 'Old' }
    });
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
    expect(presented).toBe(event);
  });

  it('returns the original event when no presenter is configured', async () => {
    let event = {
      id: 'evt_1',
      resource: 'widget',
      action: 'create',
      payload: { oid: 1n }
    };

    let presented = await presentStashedAuditEvent(event as any);

    expect(present).not.toHaveBeenCalled();
    expect(presented).toBe(event);
  });
});
