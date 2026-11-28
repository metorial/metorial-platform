import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/lib/links', async () => (await import('./_mocks')).linksModule);

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
import { links, linksModule, mocks, resetMocks, storedSettings } from './_mocks';

mocks.agentTracking = {
  organization: { upsert: vi.fn(async () => ({ id: 'org_1' })), archive: vi.fn() },
  project: { upsert: vi.fn(async () => ({ id: 'proj_1' })), archive: vi.fn() },
  instance: { upsert: vi.fn(async () => ({ id: 'inst_1' })), archive: vi.fn() }
};

let run = (data: { type: 'organization' | 'project' | 'instance'; id: string }) =>
  (syncScopeQueueProcessor as any).handler(data);

let organization = { oid: 1n, id: 'org_1', name: 'Acme', status: 'active' };
let project = { oid: 2n, id: 'proj_1', name: 'Production', status: 'active', organization };
let linked = <T extends object>(row: T) => ({ ...row, agentTrackingLinkedAt: new Date() });

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

  it.each([
    [
      'organization',
      () => vi.mocked(db.organization.findUnique).mockResolvedValue(organization as any)
    ],
    ['project', () => vi.mocked(db.project.findUnique).mockResolvedValue(project as any)],
    ['instance', () => vi.mocked(db.instance.findUnique).mockResolvedValue(instance as any)]
  ] as const)(
    'leaves an unlinked %s to its first use instead of creating it',
    async (type, load) => {
      load();

      await run({ type, id: 'any' });

      for (let scope of Object.values(mocks.agentTracking)) {
        expect(scope.upsert).not.toHaveBeenCalled();
      }
      expect([links.organization.size, links.project.size, links.instance.size]).toEqual([
        0, 0, 0
      ]);
    }
  );

  it('pushes the current name of a linked organization', async () => {
    links.organization.add(1n);
    vi.mocked(db.organization.findUnique).mockResolvedValue(linked(organization) as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      { ref: 'org_1', name: 'Acme' },
      undefined
    );
    expect(mocks.agentTracking.organization.archive).not.toHaveBeenCalled();
  });

  it('archives a deleted organization and drops every link below it', async () => {
    links.organization.add(1n);
    links.project.add(2n);
    links.instance.add(3n);
    vi.mocked(db.organization.findUnique).mockResolvedValue({
      ...organization,
      status: 'deleted'
    } as any);

    await run({ type: 'organization', id: 'org_1' });

    expect(mocks.agentTracking.organization.archive).toHaveBeenCalledWith({
      organizationId: 'org_1'
    });
    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
    expect(linksModule.unlinkOrganizationTree).toHaveBeenCalledWith(
      expect.objectContaining({ oid: 1n })
    );
    expect([links.organization.size, links.project.size, links.instance.size]).toEqual([
      0, 0, 0
    ]);
  });

  it('skips rows that no longer exist', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(null);

    await run({ type: 'project', id: 'proj_gone' });

    expect(mocks.agentTracking.project.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.project.archive).not.toHaveBeenCalled();
  });

  it('ensures the organization before it pushes a linked project', async () => {
    vi.mocked(db.project.findUnique).mockResolvedValue(linked(project) as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      { ref: 'org_1', name: 'Acme' },
      undefined
    );
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledWith(
      { organizationId: 'org_1', ref: 'proj_1', name: 'Production' },
      undefined
    );
    expect(mocks.agentTracking.organization.upsert.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.agentTracking.project.upsert.mock.invocationCallOrder[0]!
    );
  });

  it('pushes a linked project without the organization once the organization is linked', async () => {
    links.organization.add(1n);
    vi.mocked(db.project.findUnique).mockResolvedValue(linked(project) as any);

    await run({ type: 'project', id: 'proj_1' });

    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.project.upsert).toHaveBeenCalledTimes(1);
    expect(links.project.has(2n)).toBe(true);
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

  it('sends no settings Metorial has never stored, so values set in the service stay', async () => {
    vi.mocked(db.instance.findUnique).mockResolvedValue(linked(instance) as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.organization.upsert.mock.calls[0]![0].settings).toBeUndefined();
    expect(mocks.agentTracking.project.upsert.mock.calls[0]![0]).not.toHaveProperty(
      'recordRetentionDays'
    );
    expect(mocks.agentTracking.instance.upsert.mock.calls[0]![0].settings).toBeUndefined();
  });

  it('pushes the settings stored in Metorial with every scope', async () => {
    storedSettings.organization = {
      hideIndividuals: true,
      minGroupUsers: 8,
      toolDetails: true,
      sessionContext: false,
      sessionTitles: true,
      historyImport: false,
      historyImportDays: 180,
      ticketUrlTemplate: 'https://linear.app/acme/issue/{key}'
    };
    storedSettings.project = { recordDays: 30, contentDays: null, usageDays: 200 };
    storedSettings.instance = { mode: 'full', deterministicEnabled: false, aiEnabled: true };
    vi.mocked(db.instance.findUnique).mockResolvedValue(linked(instance) as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.organization.upsert.mock.calls[0]![0].settings).toEqual({
      privacy: { hideIndividuals: true, minGroupUsers: 8 },
      desktop: {
        toolDetails: true,
        sessionContext: false,
        sessionTitles: true,
        historyImport: false,
        historyImportDays: 180
      }
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

  it('pushes only a linked instance while its project and organization are linked', async () => {
    links.organization.add(1n);
    links.project.add(2n);
    vi.mocked(db.instance.findUnique).mockResolvedValue(linked(instance) as any);

    await run({ type: 'instance', id: 'inst_1' });

    expect(mocks.agentTracking.organization.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.project.upsert).not.toHaveBeenCalled();
    expect(mocks.agentTracking.instance.upsert).toHaveBeenCalledTimes(1);
    expect(links.instance.has(3n)).toBe(true);
  });

  it('archives a deleted instance and drops only its own link', async () => {
    links.organization.add(1n);
    links.project.add(2n);
    links.instance.add(3n);
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
    expect([...links.instance]).toEqual([]);
    expect(links.project.has(2n)).toBe(true);
    expect(links.organization.has(1n)).toBe(true);
  });
});
