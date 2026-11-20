import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  gateway: {
    organization: { upsert: vi.fn(), archive: vi.fn() },
    project: { upsert: vi.fn(), archive: vi.fn() },
    instance: { upsert: vi.fn(), archive: vi.fn() }
  },
  fire: vi.fn(),
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
  addAfterTransactionHook: async (hook: () => unknown) => await hook(),
  db: {
    organization: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    instance: { findUnique: vi.fn(), update: vi.fn() }
  }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('../src/lib/client', () => ({
  getAiGateway: () => (mocks.enabled.value ? mocks.gateway : null),
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

let gatewayProject = (platformLimitsSyncedAt: Date | null) => ({
  id: 'agpr_1',
  ref: 'proj_1',
  platformLimitsSyncedAt
});

describe('ai-gateway/sync/scope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled.value = true;
    mocks.gateway.project.upsert.mockResolvedValue(gatewayProject(new Date()));
    mocks.gateway.instance.upsert.mockResolvedValue({ id: 'agin_1' });
  });

  it('does nothing while the gateway is not configured', async () => {
    mocks.enabled.value = false;

    await run({ type: 'organization', id: 'org_1' });

    expect(db.organization.findUnique).not.toHaveBeenCalled();
    expect(mocks.gateway.organization.upsert).not.toHaveBeenCalled();
  });

  it('upserts an active organization by its core id', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.gateway.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.gateway.organization.archive).not.toHaveBeenCalled();
  });

  it('archives a deleted organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.gateway.organization.archive).toHaveBeenCalledWith({
      organizationId: 'org_1'
    });
    expect(mocks.gateway.organization.upsert).not.toHaveBeenCalled();
  });

  it('skips rows that no longer exist', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);

    await run({ type: 'project', id: 'proj_gone' });

    expect(mocks.gateway.project.upsert).not.toHaveBeenCalled();
    expect(mocks.gateway.project.archive).not.toHaveBeenCalled();
  });

  it('upserts a project together with its organization', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.gateway.organization.upsert).toHaveBeenCalledWith({
      ref: 'org_1',
      name: 'Acme'
    });
    expect(mocks.gateway.project.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      ref: 'proj_1',
      name: 'Production'
    });
  });

  it('announces a project whose plan limits were never synced', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);
    mocks.gateway.project.upsert.mockResolvedValue(gatewayProject(null));

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.fire).toHaveBeenCalledWith('ai_gateway.project.created:after', {
      organization,
      project,
      gatewayProjectId: 'agpr_1'
    });
  });

  it('stays quiet for a project that already has plan limits', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('archives a project of an inactive organization', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({
      ...project,
      organization: { ...organization, status: 'deleted' }
    } as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.gateway.project.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'proj_1'
    });
  });

  it('upserts an instance under the gateway project', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.gateway.instance.upsert).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'agpr_1',
      ref: 'inst_1',
      name: 'Default'
    });
    expect(db.instance.update).toHaveBeenCalledWith({
      where: { oid: 3n },
      data: { aiGatewayInstanceId: 'agin_1' }
    });
  });

  it('leaves the setup marker alone when it is already current', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      ...instance,
      aiGatewayInstanceId: 'agin_1'
    } as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.gateway.instance.upsert).toHaveBeenCalled();
    expect(db.instance.update).not.toHaveBeenCalled();
  });

  it('archives an instance whose project is gone', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      ...instance,
      project: { ...project, status: 'deleted' }
    } as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.gateway.instance.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      instanceId: 'inst_1'
    });
    expect(mocks.gateway.instance.upsert).not.toHaveBeenCalled();
  });
});
