import { v } from '@lowerdeck/validation';
import { declarePresenter, Presenter } from '@metorial/presenter';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Controller,
  Group,
  Handler,
  Path
} from '../../../../../../packages/rest/src/controller';
import { magicMcpEndpointType } from '../../../../../../presenters/src/types';

let mocks = vi.hoisted(() => ({
  createMagicMcpEndpoint: vi.fn(),
  updateMagicMcpEndpoint: vi.fn(),
  getMagicMcpEndpointById: vi.fn(),
  checkWriteAccess: vi.fn(),
  checkAccess: vi.fn(),
  checkTargetAccess: vi.fn(),
  getFlags: vi.fn()
}));

vi.mock('@metorial/rest', () => ({ Controller, Group, Handler, Path }));

vi.mock('@metorial/db', () => ({ MagicMcpEndpointStatus: {} }));

vi.mock('@metorial/module-magic', () => ({
  magicMcpEndpointService: {
    createMagicMcpEndpoint: mocks.createMagicMcpEndpoint,
    updateMagicMcpEndpoint: mocks.updateMagicMcpEndpoint,
    getMagicMcpEndpointById: mocks.getMagicMcpEndpointById,
    checkWriteAccess: mocks.checkWriteAccess
  },
  magicMcpServerService: { getMagicMcpServerById: vi.fn() }
}));

vi.mock('@metorial/consumer-magic-access', () => ({
  grantConsumerOwnedMagicMcpEndpointAccess: vi.fn()
}));

vi.mock('@metorial/module-consumer-core', () => ({
  consumerProfileService: { getConsumerProfileByIdForInstance: vi.fn() }
}));

vi.mock('@metorial/module-skill-marketplace', () => ({
  skillPluginService: { getSkillPluginById: vi.fn() }
}));

vi.mock('@metorial/module-access', () => ({
  accessService: {
    checkAccess: mocks.checkAccess,
    checkTargetAccess: mocks.checkTargetAccess
  }
}));

vi.mock('@metorial/module-flags', () => ({
  flagService: { getFlags: mocks.getFlags },
  isFlagEnabled: (flag: unknown) => flag === true,
  getFlagDisabledReason: () => undefined
}));

vi.mock('../sessions/_shared', () => ({ toolFiltersValidator: v.optional(v.any()) }));

vi.mock('../skills', () => ({ getSkillPluginAccess: vi.fn() }));

vi.mock('../../../middleware/apiGroup', () => ({ apiGroup: Group.create() }));

vi.mock('../../../middleware/instanceGroup', () => ({
  instanceGroup: Group.create(),
  instancePath: (path: string, sdkPath: string) => [
    Path(`/${path}`, sdkPath),
    Path(`/dashboard/instances/:instanceId/${path}`, `dashboard.instance.${sdkPath}`)
  ]
}));

vi.mock('@metorial/presenters', () => {
  let presenter = Presenter.create(magicMcpEndpointType)
    .presenter(async ({ magicMcpEndpoint }) => ({
      object: 'magic_mcp.endpoint',
      id: magicMcpEndpoint.id
    }))
    .schema(v.object({ object: v.string(), id: v.string() }))
    .build();

  return {
    magicMcpEndpointPresenter: declarePresenter(magicMcpEndpointType, {
      mt_2025_01_01_dashboard: presenter,
      mt_2026_01_01_magnetar: presenter
    })
  };
});

let { magicMcpEndpointController } = await import('./magicMcpEndpoint');

let endpointHandler = (method: 'create' | 'update') => {
  let handler = magicMcpEndpointController.handlers[method];
  if (!(handler instanceof Handler)) throw new Error('Expected a magic MCP endpoint handler');

  return handler;
};

let instance = { oid: 7n, project: { oid: 8n }, organization: { oid: 9n } };
let auditScope = { organizationOid: 9n };
let endpoint = { id: 'mep_1', instanceOid: instance.oid };
let context = {
  instance,
  organization: instance.organization,
  project: instance.project,
  auditScope
};

let request = (body: Record<string, unknown>) =>
  ({
    body,
    query: {},
    apiVersion: 'mt_2025_01_01_dashboard',
    auth: { type: 'machine', machineAccess: { type: 'instance_secret' } },
    params: { magicMcpEndpointId: 'mep_1' },
    sharedMiddlewareMemo: new Map()
  }) as any;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.getFlags.mockResolvedValue({ 'magic-mcp-enabled': true });
  mocks.createMagicMcpEndpoint.mockResolvedValue(endpoint);
  mocks.updateMagicMcpEndpoint.mockResolvedValue(endpoint);
  mocks.getMagicMcpEndpointById.mockResolvedValue(endpoint);
});

describe('magic MCP endpoint skill editing flag', () => {
  it.each([true, false, undefined])(
    'forwards enable_skill_editing=%s on create',
    async enableSkillEditing => {
      await endpointHandler('create').run(
        request({ name: 'Client Access', enable_skill_editing: enableSkillEditing }),
        context
      );

      expect(mocks.createMagicMcpEndpoint).toHaveBeenCalledWith(
        expect.objectContaining({
          input: expect.objectContaining({ enableSkillEditing })
        })
      );
    }
  );

  it('forwards enable_skill_editing on update', async () => {
    await endpointHandler('update').run(request({ enable_skill_editing: true }), context);

    expect(mocks.updateMagicMcpEndpoint).toHaveBeenCalledWith({
      auditScope,
      endpoint,
      input: {
        name: undefined,
        description: undefined,
        metadata: undefined,
        enableSkillEditing: true
      }
    });
  });

  it('rejects a non boolean enable_skill_editing', async () => {
    await expect(
      endpointHandler('create').run(request({ enable_skill_editing: 'yes' }), context)
    ).rejects.toMatchObject({ data: { status: 400 } });
    expect(mocks.createMagicMcpEndpoint).not.toHaveBeenCalled();
  });
});
