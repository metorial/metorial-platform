import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  calls: [] as string[],
  commitFails: { value: false },
  db: {
    $queryRaw: vi.fn(),
    agentTrackingOrganizationSettings: { upsert: vi.fn() },
    agentTrackingProjectSettings: { upsert: vi.fn() },
    agentTrackingInstanceSettings: { upsert: vi.fn() }
  },
  agentTracking: {
    organization: { upsert: vi.fn(), get: vi.fn() },
    project: { upsert: vi.fn(), get: vi.fn() },
    instance: { upsert: vi.fn(), get: vi.fn() }
  },
  fire: vi.fn(),
  queue: vi.fn()
}));

vi.mock('../src/lib/links', async () => (await import('./_mocks')).linksModule);

vi.mock('../src/lib/settings', async importOriginal =>
  (await import('./_mocks')).settingsModule(importOriginal)
);

vi.mock('@metorial/db', () => ({
  ID: { generateId: async (type: string) => `${type}_1` },
  withTransaction: async (callback: (db: typeof mocks.db) => unknown) => {
    let result = await callback(mocks.db);
    if (mocks.commitFails.value) throw new Error('commit failed');
    return result;
  }
}));

vi.mock('@metorial/fabric', () => ({ Fabric: { fire: mocks.fire } }));

vi.mock('../src/lib/client', () => ({
  requireAgentTracking: () => mocks.agentTracking,
  getAgentTracking: () => mocks.agentTracking
}));

vi.mock('../src/queues/syncScope', () => ({ syncScopeQueue: { add: mocks.queue } }));

import { notFoundError, ServiceError } from '@lowerdeck/error';
import { agentTrackingSettingsService } from '../src/services/agentTrackingSettings';
import { resetLinks, storedSettings } from './_mocks';

let organization = { oid: 1n, id: 'org_1', name: 'Acme' } as any;
let project = { oid: 2n, id: 'proj_1', name: 'Production' } as any;
let instance = { oid: 3n, id: 'inst_1', name: 'Default' } as any;
let auditScope = { actor: 'test' } as any;

let instanceScope = { organization, project, instance };

let record = (name: string) =>
  vi.fn(async (..._args: any[]) => {
    mocks.calls.push(name);
    return {};
  });

let store = (key: keyof typeof storedSettings) =>
  vi.fn(async ({ update }: { update: Record<string, unknown> }) => {
    mocks.calls.push('write');
    storedSettings[key] = { ...storedSettings[key], ...update };
    return storedSettings[key];
  });

describe('agentTrackingSettingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetLinks();
    mocks.calls.length = 0;
    mocks.commitFails.value = false;
    storedSettings.organization = null;
    storedSettings.project = null;
    storedSettings.instance = null;

    mocks.db.agentTrackingOrganizationSettings.upsert = store('organization');
    mocks.db.agentTrackingProjectSettings.upsert = store('project');
    mocks.db.agentTrackingInstanceSettings.upsert = store('instance');
    mocks.agentTracking.organization.upsert = record('push:organization');
    mocks.agentTracking.project.upsert = record('push:project');
    mocks.agentTracking.instance.upsert = record('push:instance');
  });

  it('answers the defaults and applied while nothing is stored, without asking the service', async () => {
    expect(await agentTrackingSettingsService.getInstanceSettings(instanceScope)).toEqual({
      settings: {
        organizationId: 'org_1',
        projectId: 'proj_1',
        instanceId: 'inst_1',
        content: { mode: 'basic' },
        classification: { deterministicEnabled: true, aiEnabled: false }
      },
      serviceStatus: 'applied',
      privacy: { hideIndividuals: false, minGroupUsers: 5 }
    });
    expect(
      (await agentTrackingSettingsService.getProjectSettings({ organization, project }))
        .settings.retention
    ).toEqual({ recordDays: null, contentDays: null, usageDays: null });
    expect(mocks.agentTracking.instance.get).not.toHaveBeenCalled();
  });

  it('stores a privacy change, then tells the service and audits before and after', async () => {
    let result = await agentTrackingSettingsService.updateOrganizationSettings({
      organization,
      auditScope,
      input: { privacy: { hideIndividuals: true, minGroupUsers: undefined } }
    });

    expect(result).toEqual({
      settings: {
        organizationId: 'org_1',
        privacy: { hideIndividuals: true, minGroupUsers: 5 }
      },
      serviceStatus: 'applied'
    });
    expect(mocks.calls).toEqual(['write', 'push:organization']);
    expect(mocks.db.agentTrackingOrganizationSettings.upsert).toHaveBeenCalledWith({
      where: { organizationOid: 1n },
      create: {
        id: 'agentTrackingOrganizationSettings_1',
        organizationOid: 1n,
        hideIndividuals: true,
        minGroupUsers: 5
      },
      update: { hideIndividuals: true, minGroupUsers: 5 }
    });
    expect(mocks.agentTracking.organization.upsert).toHaveBeenCalledWith(
      {
        ref: 'org_1',
        name: 'Acme',
        settings: { privacy: { hideIndividuals: true, minGroupUsers: 5 } }
      },
      { timeoutMs: 3_000, retry: false }
    );
    expect(mocks.db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(mocks.fire.mock.calls.map(([name]) => name)).toEqual([
      'agent_tracking.settings.updated:before',
      'agent_tracking.settings.updated:after'
    ]);
    expect(mocks.fire.mock.calls[1]![1]).toEqual({
      settings: result.settings,
      previousSettings: {
        organizationId: 'org_1',
        privacy: { hideIndividuals: false, minGroupUsers: 5 }
      },
      auditScope
    });
  });

  it('keeps a wider change and queues the push when the service does not answer', async () => {
    mocks.agentTracking.instance.upsert = vi.fn(async () => {
      throw new Error('agent tracking is unavailable');
    });

    let result = await agentTrackingSettingsService.updateInstanceSettings({
      ...instanceScope,
      auditScope,
      input: { content: { mode: 'shape' } }
    });

    expect(result.serviceStatus).toBe('pending');
    expect(result.settings.content.mode).toBe('shape');
    expect(mocks.db.agentTrackingInstanceSettings.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { mode: 'shape', deterministicEnabled: true, aiEnabled: false }
      })
    );
    expect(mocks.queue).toHaveBeenCalledWith(
      { type: 'instance', id: 'inst_1' },
      { id: 'instance:inst_1' }
    );
  });

  it('tells the service before storing a narrower content policy', async () => {
    storedSettings.instance = { mode: 'full', deterministicEnabled: true, aiEnabled: false };

    let result = await agentTrackingSettingsService.updateInstanceSettings({
      ...instanceScope,
      auditScope,
      input: { content: { mode: 'basic' } }
    });

    expect(result.serviceStatus).toBe('applied');
    expect(mocks.calls).toEqual([
      'push:organization',
      'push:project',
      'push:instance',
      'write',
      'push:instance'
    ]);
    expect(
      mocks.agentTracking.instance.upsert.mock.calls.map(([input]) => input.settings)
    ).toEqual([
      {
        contentPolicy: { defaultMode: 'basic' },
        classification: { enabled: true, ai: { enabled: false } }
      },
      {
        contentPolicy: { defaultMode: 'basic' },
        classification: { enabled: true, ai: { enabled: false } }
      }
    ]);
    expect(mocks.db.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('tells the service first when only the hosted model is switched off', async () => {
    storedSettings.instance = { mode: 'basic', deterministicEnabled: true, aiEnabled: true };

    await agentTrackingSettingsService.updateInstanceSettings({
      ...instanceScope,
      auditScope,
      input: { classification: { aiEnabled: false } }
    });

    expect(mocks.calls.indexOf('push:instance')).toBeLessThan(mocks.calls.indexOf('write'));
  });

  it('changes nothing when a narrower setting does not reach the service', async () => {
    storedSettings.instance = { mode: 'full', deterministicEnabled: true, aiEnabled: false };
    mocks.agentTracking.instance.upsert = vi.fn(async () => {
      throw new Error('agent tracking is unavailable');
    });

    await expect(
      agentTrackingSettingsService.updateInstanceSettings({
        ...instanceScope,
        auditScope,
        input: { content: { mode: 'basic' } }
      })
    ).rejects.toMatchObject({ data: { status: 503 } });

    expect(mocks.db.agentTrackingInstanceSettings.upsert).not.toHaveBeenCalled();
    expect(mocks.fire.mock.calls.map(([name]) => name)).toEqual([
      'agent_tracking.settings.updated:before'
    ]);
    expect(mocks.queue).toHaveBeenCalledWith(
      { type: 'instance', id: 'inst_1' },
      { id: 'instance:inst_1' }
    );
  });

  it('keeps the original error when queueing the sync fails too', async () => {
    storedSettings.instance = { mode: 'full', deterministicEnabled: true, aiEnabled: false };
    mocks.commitFails.value = true;
    mocks.queue.mockRejectedValueOnce(new Error('queue unavailable'));

    await expect(
      agentTrackingSettingsService.updateInstanceSettings({
        ...instanceScope,
        auditScope,
        input: { content: { mode: 'basic' } }
      })
    ).rejects.toThrow('commit failed');
  });

  it('leaves the service holding what is stored when a wider and a narrower change overlap', async () => {
    storedSettings.instance = { mode: 'full', deterministicEnabled: true, aiEnabled: false };

    let releaseWider!: () => void;
    let widerHeld = new Promise<void>(resolve => (releaseWider = resolve));
    let organizationPushes = 0;
    mocks.agentTracking.organization.upsert = vi.fn(async () => {
      organizationPushes++;
      if (organizationPushes == 1) await widerHeld;
      return {};
    });

    let wider = agentTrackingSettingsService.updateInstanceSettings({
      ...instanceScope,
      auditScope,
      input: { classification: { aiEnabled: true } }
    });
    await vi.waitFor(() => expect(organizationPushes).toBe(1));

    let narrower = await agentTrackingSettingsService.updateInstanceSettings({
      ...instanceScope,
      auditScope,
      input: { content: { mode: 'basic' } }
    });
    releaseWider();
    await wider;

    expect(narrower.serviceStatus).toBe('applied');
    expect(storedSettings.instance).toMatchObject({ mode: 'basic', aiEnabled: true });
    expect(mocks.agentTracking.instance.upsert.mock.calls.at(-1)![0].settings).toEqual({
      contentPolicy: { defaultMode: 'basic' },
      classification: { enabled: true, ai: { enabled: true } }
    });
  });

  it('queues a sync when the narrower setting reached the service but the commit failed', async () => {
    storedSettings.instance = { mode: 'full', deterministicEnabled: true, aiEnabled: false };
    mocks.commitFails.value = true;

    await expect(
      agentTrackingSettingsService.updateInstanceSettings({
        ...instanceScope,
        auditScope,
        input: { content: { mode: 'basic' } }
      })
    ).rejects.toThrow('commit failed');

    expect(mocks.queue).toHaveBeenCalledWith(
      { type: 'instance', id: 'inst_1' },
      { id: 'instance:inst_1' }
    );
  });

  it('changes nothing and fires nothing when the input holds the current values', async () => {
    let result = await agentTrackingSettingsService.updateProjectSettings({
      organization,
      project,
      auditScope,
      input: { retention: { recordDays: null } }
    });

    expect(result).toEqual({
      settings: {
        organizationId: 'org_1',
        projectId: 'proj_1',
        retention: { recordDays: null, contentDays: null, usageDays: null }
      },
      serviceStatus: 'applied'
    });
    expect(mocks.calls).toEqual([]);
    expect(mocks.fire).not.toHaveBeenCalled();
  });

  it('compares stored retention with the defaults the service fills in', async () => {
    storedSettings.project = { recordDays: 30, contentDays: null, usageDays: null };
    mocks.agentTracking.project.get.mockResolvedValue({
      recordRetentionDays: 30,
      contentRetentionDays: 30,
      usageRetentionDays: 400
    });

    expect(
      (await agentTrackingSettingsService.getProjectSettings({ organization, project }))
        .serviceStatus
    ).toBe('applied');

    mocks.agentTracking.project.get.mockResolvedValue({
      recordRetentionDays: 90,
      contentRetentionDays: 30,
      usageRetentionDays: 400
    });

    expect(
      (await agentTrackingSettingsService.getProjectSettings({ organization, project }))
        .serviceStatus
    ).toBe('pending');
    expect(mocks.queue).toHaveBeenCalledTimes(1);
    expect(mocks.queue).toHaveBeenCalledWith(
      { type: 'project', id: 'proj_1' },
      { id: 'project:proj_1' }
    );
  });

  it('answers pending while the service does not know the instance, and unknown when it cannot be asked', async () => {
    storedSettings.instance = { mode: 'shape', deterministicEnabled: true, aiEnabled: false };
    mocks.agentTracking.instance.get.mockRejectedValueOnce(
      new ServiceError(notFoundError('instance'))
    );
    mocks.agentTracking.instance.get.mockRejectedValueOnce(new Error('timeout'));

    let status = async () =>
      (await agentTrackingSettingsService.getInstanceSettings(instanceScope)).serviceStatus;

    expect(await status()).toBe('pending');
    expect(await status()).toBe('unknown');
    expect(mocks.queue).toHaveBeenCalledTimes(1);
  });

  it('answers applied when the service holds the stored values among others', async () => {
    storedSettings.instance = { mode: 'shape', deterministicEnabled: true, aiEnabled: false };
    mocks.agentTracking.instance.get.mockResolvedValue({
      settings: {
        ephemeralDeviceIdleDays: 7,
        contentPolicy: { defaultMode: 'shape' },
        classification: { enabled: true, threshold: 0.8, ai: { enabled: false } }
      }
    });

    expect(
      (await agentTrackingSettingsService.getInstanceSettings(instanceScope)).serviceStatus
    ).toBe('applied');
  });

  it('never applies a stored minimum below three', async () => {
    storedSettings.organization = { hideIndividuals: true, minGroupUsers: 2 };

    expect(await agentTrackingSettingsService.getPrivacy({ organization })).toEqual({
      hideIndividuals: true,
      minGroupUsers: 3
    });
  });
});
