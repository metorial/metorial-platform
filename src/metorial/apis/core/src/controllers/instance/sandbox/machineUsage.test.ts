import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { declarePresenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../packages/rest/src/controller';
import { introspectApi } from '../../../../../../packages/rest/src/introspect';
import { v1SandboxMachineUsageTimelinePresenter } from '../../../../../../presenters/src/implementation/sandbox/machineUsageTimeline';
import { v1SandboxMachineUsageSummaryPresenter } from '../../../../../../presenters/src/implementation/sandbox/machineUsageSummary';
import {
  sandboxMachineUsageTimelineType,
  sandboxMachineUsageSummaryType
} from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  timeline: vi.fn(),
  summary: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/module-sandbox', () => ({
  sandboxMachineUsageService: { timeline: mocks.timeline, summary: mocks.summary }
}));
vi.mock('@metorial/module-access', () => ({
  accessService: { checkAccess: mocks.checkAccess, checkTargetAccess: mocks.checkTargetAccess }
}));
vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: unknown) => flag === true,
  getFlagDisabledReason: () => undefined
}));
vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));
vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/instances/:instanceId/${path}`, `management.instance.${sdkPath}`),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));
vi.mock('@metorial/presenters', () => ({
  sandboxMachineUsageTimelinePresenter: declarePresenter(sandboxMachineUsageTimelineType, {
    mt_2025_01_01_dashboard: v1SandboxMachineUsageTimelinePresenter,
    mt_2026_01_01_magnetar: v1SandboxMachineUsageTimelinePresenter
  }),
  sandboxMachineUsageSummaryPresenter: declarePresenter(sandboxMachineUsageSummaryType, {
    mt_2025_01_01_dashboard: v1SandboxMachineUsageSummaryPresenter,
    mt_2026_01_01_magnetar: v1SandboxMachineUsageSummaryPresenter
  })
}));

let { sandboxMachineUsageController } = await import('./machineUsage');

let usageHandler = (method: 'timeline' | 'summary') => {
  let handler = sandboxMachineUsageController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a usage handler');

  return handler;
};

let versions = ['mt_2026_01_01_magnetar', 'mt_2025_01_01_dashboard'] as const;

let instance = { oid: 7n, project: { oid: 8n }, organization: { oid: 9n } };

let request = (query: Record<string, unknown>, apiVersion: string = versions[0]) =>
  ({
    body: {},
    query,
    apiVersion,
    auth: { type: 'machine' },
    params: { machineId: 'sbm_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

let context = { instance, organization: instance.organization, project: instance.project };

let range = { from: '2026-01-01T00:00:00.000Z', to: '2026-01-01T01:00:00.000Z' };

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'sandbox-enabled': true, 'paid-sandboxes': true });
});

describe('sandbox machine usage endpoints', () => {
  it.each(versions)('introspects route aliases and response schemas for %s', version => {
    let root = Controller.create(
      { name: 'Test', description: 'Test' },
      { usage: sandboxMachineUsageController }
    );
    let introspection = introspectApi({
      rootController: root,
      displayVersion: version,
      version,
      isCurrent: true
    });

    expect(introspection.endpoints).toHaveLength(2);
    for (let method of ['timeline', 'summary'] as const) {
      let endpoint = introspection.endpoints.find(endpoint =>
        endpoint.path.sdkPath.endsWith(`.${method}`)
      );

      expect(endpoint.method).toBe('get');
      expect(endpoint.allPaths).toEqual([
        {
          path: `/sandbox/machines/:machineId/usage/${method}`,
          sdkPath: `sandbox.machines.usage.${method}`
        },
        {
          path: `/instances/:instanceId/sandbox/machines/:machineId/usage/${method}`,
          sdkPath: `management.instance.sandbox.machines.usage.${method}`
        },
        {
          path: `/dashboard/instances/:instanceId/sandbox/machines/:machineId/usage/${method}`,
          sdkPath: `dashboard.instance.sandbox.machines.usage.${method}`
        }
      ]);
      let output = introspection.types.find(type => type.id === endpoint.outputId)!
        .type as any;
      let query = introspection.types.find(type => type.id === endpoint.queryId)!.type as any;

      expect(output.properties.object.examples).toContain(`sandbox.machine.usage.${method}`);
      expect(query.properties.from.optional).toBe(false);
      expect(query.properties.to.optional).toBe(false);
      expect(query.properties.max_series.description).toContain('default 50');
    }
  });

  it.each([{ ids: 'run_1' }, { ids: ['run_1', 'run_2'] }])(
    'normalizes execution filters: %o',
    async ({ ids }) => {
      await usageHandler('timeline').run(
        request({
          ...range,
          machine_instance_id: ids,
          group_by: 'machine_instance',
          max_series: '2',
          interval: '5m'
        }),
        context
      );

      expect(mocks.timeline).toHaveBeenCalledWith({
        instance,
        machineId: 'sbm_1',
        from: new Date(range.from),
        to: new Date(range.to),
        instanceIds: Array.isArray(ids) ? ids : [ids],
        groupBy: 'machine_instance',
        maxSeries: 2,
        interval: '5m'
      });
      expect(mocks.checkAccess).toHaveBeenCalledWith(
        expect.objectContaining({ possibleScopes: ['instance.sandbox:read'] })
      );
      expect(mocks.checkTargetAccess).toHaveBeenCalledWith(
        expect.objectContaining({ instance })
      );
    }
  );

  it('calls summary with the same filters and no timeline interval', async () => {
    await usageHandler('summary').run(request(range), context);

    expect(mocks.summary).toHaveBeenCalledWith({
      instance,
      machineId: 'sbm_1',
      from: new Date(range.from),
      to: new Date(range.to),
      instanceIds: undefined,
      groupBy: undefined,
      maxSeries: undefined
    });
  });

  it.each([
    {},
    { ...range, from: 'invalid' },
    { ...range, interval: '2m' },
    { ...range, max_series: '0' },
    { ...range, max_series: '201' },
    { ...range, max_series: '1.5' },
    { ...range, group_by: 'machine' }
  ])('rejects invalid queries: %o', async query => {
    await expect(usageHandler('timeline').run(request(query), context)).rejects.toMatchObject({
      data: { status: 400 }
    });
    expect(mocks.timeline).not.toHaveBeenCalled();
  });

  it.each([
    [{ 'sandbox-enabled': false, 'paid-sandboxes': true }, 403],
    [{ 'sandbox-enabled': true, 'paid-sandboxes': false }, 402]
  ])('enforces existing sandbox flags: %o', async (flags, status) => {
    mocks.getFlags.mockResolvedValue(flags);

    await expect(usageHandler('timeline').run(request(range), context)).rejects.toMatchObject({
      data: { status }
    });
    expect(mocks.timeline).not.toHaveBeenCalled();
  });

  it('rejects callers without sandbox read access', async () => {
    mocks.checkAccess.mockRejectedValue(new ServiceError(forbiddenError()));

    await expect(usageHandler('summary').run(request(range), context)).rejects.toMatchObject({
      data: { status: 403 }
    });
    expect(mocks.summary).not.toHaveBeenCalled();
  });
});
