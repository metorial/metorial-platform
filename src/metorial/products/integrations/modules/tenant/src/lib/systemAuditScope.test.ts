import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  instance: { findUnique: vi.fn() },
  project: { findUnique: vi.fn() }
}));

vi.mock('@metorial-subspace/db', () => ({
  db: { instance: mocks.instance, project: mocks.project }
}));

import { getSubspaceSystemAuditScope } from './systemAuditScope';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.instance.findUnique.mockResolvedValue({ organizationOid: 1n });
  mocks.project.findUnique.mockResolvedValue({ organizationOid: 2n });
});

describe('getSubspaceSystemAuditScope', () => {
  it('files against the instance when there is one', async () => {
    let scope = await getSubspaceSystemAuditScope({
      job: 'subspace/ephemeralManagedSession',
      instanceOid: 3n,
      projectOid: 4n
    });

    expect(scope).toMatchObject({
      organizationOid: 1n,
      instanceOid: 3n,
      actor: { type: 'system', id: 'subspace/ephemeralManagedSession' },
      context: { ip: '' }
    });
    // the project is not consulted when an instance resolves
    expect(mocks.project.findUnique).not.toHaveBeenCalled();
  });

  it('falls back to the project organization for records with no instance', async () => {
    let scope = await getSubspaceSystemAuditScope({
      job: 'subspace/managedProviderAuthCredentials',
      projectOid: 4n
    });

    expect(scope?.organizationOid).toBe(2n);
    expect(scope?.instanceOid).toBeUndefined();
    expect(scope?.actor.type).toBe('system');
  });

  it('carries the job metadata onto the actor', async () => {
    let scope = await getSubspaceSystemAuditScope({
      job: 'subspace/ephemeralManagedSession',
      instanceOid: 3n,
      metadata: { sessionId: 'ses_1' }
    });

    expect(scope?.actor.metadata).toEqual({ sessionId: 'ses_1' });
  });

  it('memoises the lookup rather than repeating it per row', async () => {
    await getSubspaceSystemAuditScope({ job: 'j', instanceOid: 77n });
    await getSubspaceSystemAuditScope({ job: 'j', instanceOid: 77n });
    await getSubspaceSystemAuditScope({ job: 'j', instanceOid: 77n });

    expect(mocks.instance.findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns no scope rather than guessing when nothing resolves', async () => {
    mocks.instance.findUnique.mockResolvedValue(null);
    mocks.project.findUnique.mockResolvedValue(null);

    expect(
      await getSubspaceSystemAuditScope({ job: 'j', instanceOid: 900n, projectOid: 901n })
    ).toBeNull();
    expect(await getSubspaceSystemAuditScope({ job: 'j' })).toBeNull();
  });
});
