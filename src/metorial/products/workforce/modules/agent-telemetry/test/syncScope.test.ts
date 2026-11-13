import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  groundstation: {
    organization: { upsert: vi.fn(), archive: vi.fn() },
    project: { upsert: vi.fn(), archive: vi.fn() },
    instance: { upsert: vi.fn(), archive: vi.fn() }
  },
  enabled: { value: true }
}));

vi.mock('@metorial/queue', () => ({
  createQueue: vi.fn(config => ({
    name: config.name,
    add: vi.fn(),
    process: vi.fn(handler => ({ handler }))
  }))
}));

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    instance: { findUnique: vi.fn() }
  }
}));

vi.mock('../src/internal/groundstation', () => ({
  getGroundstation: () => (mocks.enabled.value ? mocks.groundstation : null),
  ignoreNotFound: (promise: Promise<unknown>) => promise
}));

import { db } from '@metorial/db';
import { syncScopeQueueProcessor } from '../src/queues/syncScope';

let run = (data: { type: 'organization' | 'project' | 'instance'; id: string }) =>
  (syncScopeQueueProcessor as any).handler(data);

let organization = { oid: 1n, id: 'org_1', name: 'Acme', status: 'active' };
let project = { oid: 2n, id: 'proj_1', name: 'Production', status: 'active', organization };
let instance = {
  oid: 3n,
  id: 'inst_1',
  name: 'Default',
  status: 'active',
  organization,
  project
};

describe('agent-telemetry/sync/scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
  });

  it('does nothing while Groundstation is not configured', async () => {
    mocks.enabled.value = false;

    await run({ type: 'organization', id: 'org_1' });

    expect(db.organization.findUnique).not.toHaveBeenCalled();
    expect(mocks.groundstation.organization.upsert).not.toHaveBeenCalled();
  });

  it('upserts an active organization by ref', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.groundstation.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.groundstation.organization.archive).not.toHaveBeenCalled();
  });

  it('archives a deleted organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.groundstation.organization.archive).toHaveBeenCalledWith({
      organizationId: 'org_1'
    });
    expect(mocks.groundstation.organization.upsert).not.toHaveBeenCalled();
  });

  it('skips rows that no longer exist', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);

    await run({ type: 'project', id: 'proj_gone' });

    expect(mocks.groundstation.project.upsert).not.toHaveBeenCalled();
    expect(mocks.groundstation.project.archive).not.toHaveBeenCalled();
  });

  it('upserts the organization before its project', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.groundstation.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.groundstation.project.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      ref: 'proj_1',
      name: 'Production'
    });
    expect(mocks.groundstation.organization.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.groundstation.project.upsert.mock.invocationCallOrder[0]!
    );
  });

  it('archives a project whose organization was deleted', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({
      ...project,
      organization: { ...organization, status: 'deleted' }
    } as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.groundstation.project.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'proj_1'
    });
    expect(mocks.groundstation.project.upsert).not.toHaveBeenCalled();
  });

  it('upserts an instance with its project and organization', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.groundstation.project.upsert).toHaveBeenCalled();
    expect(mocks.groundstation.instance.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'proj_1',
      ref: 'inst_1',
      name: 'Default'
    });
  });

  it('archives a deleted instance', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      ...instance,
      status: 'deleted'
    } as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.groundstation.instance.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      instanceId: 'inst_1'
    });
    expect(mocks.groundstation.instance.upsert).not.toHaveBeenCalled();
  });
});
