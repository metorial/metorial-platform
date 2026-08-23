import { beforeEach, describe, expect, it, vi } from 'vitest';

let { defaultValidator, actionValidator, stashAuditEvent, generateId } = vi.hoisted(() => ({
  defaultValidator: {
    validate: vi.fn()
  },
  actionValidator: {
    validate: vi.fn()
  },
  stashAuditEvent: vi.fn(),
  generateId: vi.fn()
}));

vi.mock('@metorial/audit-schema', () => ({
  auditResources: {
    widget: {
      payload: defaultValidator,
      actions: {
        create: true,
        update: {
          validationType: actionValidator
        }
      }
    }
  }
}));

vi.mock('../lib/stash', () => ({
  stashAuditEvent
}));

vi.mock('@metorial/db', () => ({
  ID: {
    generateId
  }
}));

import { auditTrackerService } from './auditTracker';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: {
    type: 'org_actor' as const,
    id: 'oac_1'
  },
  context: {} as any
};

describe('auditTrackerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultValidator.validate.mockImplementation(value => ({
      success: true,
      value
    }));
    actionValidator.validate.mockImplementation(value => ({
      success: true,
      value: {
        ...value,
        validated: true
      }
    }));
    stashAuditEvent.mockResolvedValue(undefined);
    generateId.mockResolvedValue('evt_test');
  });

  it.each([
    ['direct scope', auditScope],
    ['wrapped scope', { auditScope }]
  ])('normalizes %s and stashes a validated event', async (_label, scope) => {
    await (auditTrackerService.recordEvent as any)(scope, 'widget', 'create', {
      payload: {
        oid: 4n
      },
      previousPayload: {
        oid: 2n
      }
    });

    expect(defaultValidator.validate).toHaveBeenCalledWith({
      oid: 4n
    });
    expect(generateId).toHaveBeenCalledWith('auditEvent');
    expect(stashAuditEvent).toHaveBeenCalledWith({
      id: 'evt_test',
      ...auditScope,
      resource: 'widget',
      action: 'create',
      payload: {
        oid: 4n
      },
      previousPayload: {
        oid: 2n
      },
      recordedAt: expect.any(Date)
    });
  });

  it('uses an action-specific validator and stashes its transformed value', async () => {
    await (auditTrackerService.recordEvent as any)(auditScope, 'widget', 'update', {
      payload: {
        name: 'Updated'
      }
    });

    expect(actionValidator.validate).toHaveBeenCalledWith({
      name: 'Updated'
    });
    expect(defaultValidator.validate).not.toHaveBeenCalled();
    expect(stashAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: {
          name: 'Updated',
          validated: true
        }
      })
    );
  });

  it('preserves an explicitly captured event timestamp', async () => {
    let recordedAt = new Date('2026-08-13T08:00:00.000Z');

    await (auditTrackerService.recordEvent as any)(auditScope, 'widget', 'create', {
      payload: {
        oid: 4n
      },
      recordedAt
    });

    expect(stashAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        recordedAt
      })
    );
  });

  it('stashes a system actor without an organization actor oid', async () => {
    await (auditTrackerService.recordEvent as any)(
      {
        organizationOid: 1n,
        instanceOid: 3n,
        actor: {
          type: 'system',
          id: 'audit-worker'
        },
        context: {} as any
      },
      'widget',
      'create',
      {
        payload: {
          oid: 4n
        }
      }
    );

    expect(stashAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationActorOid: undefined,
        actor: {
          type: 'system',
          id: 'audit-worker'
        }
      })
    );
  });

  it('rejects invalid payloads without stashing them', async () => {
    actionValidator.validate.mockReturnValueOnce({
      success: false,
      errors: [
        {
          code: 'invalid_type',
          message: 'Expected a string',
          path: ['name']
        }
      ]
    });

    await expect(
      (auditTrackerService.recordEvent as any)(auditScope, 'widget', 'update', {
        payload: {
          name: 123
        }
      })
    ).rejects.toThrow('Invalid audit event payload: name: Expected a string');
    expect(stashAuditEvent).not.toHaveBeenCalled();
  });

  it('validates and rejects an invalid previous payload', async () => {
    actionValidator.validate
      .mockReturnValueOnce({
        success: true,
        value: {
          name: 'Updated'
        }
      })
      .mockReturnValueOnce({
        success: false,
        errors: [
          {
            code: 'invalid_type',
            message: 'Expected a string',
            path: ['name']
          }
        ]
      });

    await expect(
      (auditTrackerService.recordEvent as any)(auditScope, 'widget', 'update', {
        payload: {
          name: 'Updated'
        },
        previousPayload: {
          name: 123
        }
      })
    ).rejects.toThrow('Invalid previous audit event payload: name: Expected a string');
    expect(stashAuditEvent).not.toHaveBeenCalled();
  });
});
