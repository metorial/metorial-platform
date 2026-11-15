import { describe, expect, it, vi } from 'vitest';

let { recordEvent, recordEvents } = vi.hoisted(() => ({
  recordEvent: vi.fn(),
  recordEvents: vi.fn()
}));

vi.mock('@metorial/audit-schema', () => ({ auditResources: { widget: {} } }));
vi.mock('@metorial/audit-stash', () => ({
  createAuditRecorder: vi.fn(() => ({ recordEvent, recordEvents }))
}));

import { auditTrackerService } from './auditTracker';

let auditScope = {
  organizationOid: 1n,
  instanceOid: 3n,
  organizationActorOid: 4n,
  actor: { type: 'org_actor' as const, id: 'oac_1' },
  context: {} as any
};

/**
 * The validate-and-stash behaviour these tests used to cover now lives in
 * `@metorial/audit-stash`, and is tested there. What is left here is the contract this
 * service still owns: that it is bound to the full audit schema and passes calls through
 * unchanged.
 */
describe('auditTrackerService', () => {
  it('passes a recorded event through to the recorder untouched', async () => {
    let event = { payload: { oid: 4n }, previousPayload: { oid: 2n } };

    await (auditTrackerService.recordEvent as any)(auditScope, 'widget', 'create', event);

    expect(recordEvent).toHaveBeenCalledWith(auditScope, 'widget', 'create', event);
  });

  it('passes a batch through to the recorder untouched', async () => {
    let events = [
      { scope: auditScope, resource: 'widget', action: 'create', payload: { oid: 1n } }
    ];

    await (auditTrackerService.recordEvents as any)(events);

    expect(recordEvents).toHaveBeenCalledWith(events);
  });
});
