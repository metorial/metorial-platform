import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/settings', async importOriginal =>
  (await import('./_mocks')).settingsModule(importOriginal)
);

vi.mock('@metorial/queue', async () => (await import('./_mocks')).queueModule);

vi.mock('@metorial/db', () => ({
  db: {
    organization: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    instance: { findUnique: vi.fn() }
  }
}));

vi.mock('../src/lib/client', async () => (await import('./_mocks')).clientModule);

vi.mock('../src/lib/flag', async () => (await import('./_mocks')).flagModule);

import { db } from '@metorial/db';
import { syncScopeQueueProcessor } from '../src/queues/syncScope';
import { mocks, resetMocks, storedSettings } from './_mocks';

mocks.agentTracking = {
  organization: { upsert: vi.fn(), archive: vi.fn() },
  project: { upsert: vi.fn(), archive: vi.fn() },
  instance: { upsert: vi.fn(), archive: vi.fn() }
};

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

describe('agent-tracking/sync/scope', () => {
  beforeEach(() => {
    resetMocks();
    storedSettings.organization = null;
    storedSettings.project = null;
    storedSettings.instance = null;
  });

  it('does nothing while agent tracking is not configured', async () => {
    mocks.enabled.value = false;

    await run({ type: 'organization', id: 'org_1' });

    expect(db.organization.findUnique).not.toHaveBeenCalled();
    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
  });

  it.each([
    [
      'organization',
      () => vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any)
    ],
    ['project', () => vi.mocked(db.project.findUnique).mockResolvedValue(project as any)],
    ['instance', () => vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any)]
  ] as const)(
    'leaves a %s alone while its organization does not have the agent tracking flag',
    async (type, load) => {
      mocks.flagged.value = false;
      load();

      await run({ type, id: 'any' });

      expect(mocks.flagChecks).toEqual([
        expect.objectContaining({ organization: expect.objectContaining({ id: 'org_1' }) })
      ]);
      for (let scope of Object.values(mocks.agentTracking)) {
        expect(scope.upsert).not.toHaveBeenCalled();
        expect(scope.archive).not.toHaveBeenCalled();
      }
    }
  );

  it('leaves a deleted organization alone without the agent tracking flag', async () => {
    mocks.flagged.value = false;
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.agentTracking.organization.archive).not.toHaveBeenCalled();
  });

  it('upserts an active organization by ref', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      {
        ref: 'org_1',
        name: 'Acme'
      },
      undefined
    );
    expect(mocks.agentTracking.organization.archive).not.toHaveBeenCalled();
  });

  it('archives a deleted organization', async () => {
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.agentTracking.organization.archive).toHaveBeenCalledWith({
      organizationId: 'org_1'
    });
    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
  });

  it('skips rows that no longer exist', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);

    await run({ type: 'project', id: 'proj_gone' });

    expect(mocks.agentTracking.project.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.project.archive).not.toHaveBeenCalled();
  });

  it('upserts the organization before its project', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(project as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      {
        ref: 'org_1',
        name: 'Acme'
      },
      undefined
    );
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledWith(
      {
        organizationId: 'org_1',
        ref: 'proj_1',
        name: 'Production'
      },
      undefined
    );
    expect(mocks.agentTracking.organization.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.agentTracking.project.upsert.mock.invocationCallOrder[0]!
    );
  });

  it('archives a project whose organization was deleted', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue({
      ...project,
      organization: { ...organization, status: 'deleted' }
    } as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.agentTracking.project.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      projectId: 'proj_1'
    });
    expect(mocks.agentTracking.project.upsert).not.toHaveBeenCalled();
  });

  it('upserts an instance with its project and organization', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.project.upsert).toHaveBeenCalled();
    expect(mocks.agentTracking.instance.upsert).toHaveBeenCalledWith(
      {
        organizationId: 'org_1',
        projectId: 'proj_1',
        ref: 'inst_1',
        name: 'Default'
      },
      undefined
    );
  });

  it('sends no settings Metorial has never stored, so values set in the service stay', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.organization.upsert.mock.calls[0]![0].settings).toBeUndefined();
    expect(mocks.agentTracking.project.upsert.mock.calls[0]![0]).not.toHaveProperty(
      'recordRetentionDays'
    );
    expect(mocks.agentTracking.instance.upsert.mock.calls[0]![0].settings).toBeUndefined();
  });

  it('pushes the settings stored in Metorial with every scope', async () => {
    storedSettings.organization = { hideIndividuals: true, minGroupUsers: 8 };
    storedSettings.project = { recordDays: 30, contentDays: null, usageDays: 200 };
    storedSettings.instance = { mode: 'full', deterministicEnabled: false, aiEnabled: true };
    vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.organization.upsert.mock.calls[0]![0].settings).toEqual({
      privacy: { hideIndividuals: true, minGroupUsers: 8 }
    });
    expect(mocks.agentTracking.project.upsert.mock.calls[0]![0]).toMatchObject({
      recordRetentionDays: 30,
      contentRetentionDays: null,
      usageRetentionDays: 200
    });
    expect(mocks.agentTracking.instance.upsert.mock.calls[0]![0].settings).toEqual({
      contentPolicy: { defaultMode: 'full' },
      classification: { enabled: false, ai: { enabled: true } }
    });
  });

  it('archives a deleted instance', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue({
      ...instance,
      status: 'deleted'
    } as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.instance.archive).toHaveBeenCalledWith({
      organizationId: 'org_1',
      instanceId: 'inst_1'
    });
    expect(mocks.agentTracking.instance.upsert).not.toHaveBeenCalled();
  });
});
