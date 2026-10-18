import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  ensureForProject: vi.fn(),
  upsertTenant: vi.fn(),
  projectUpdate: vi.fn(),
  fire: vi.fn()
}));

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((name, factory) => ({ build: () => factory() }))
  }
}));

vi.mock('@metorial/db', () => ({
  db: { project: { update: mocks.projectUpdate } }
}));

vi.mock('@metorial/fabric', () => ({
  Fabric: { fire: mocks.fire }
}));

vi.mock('@metorial-subspace/module-tenant', async () => ({
  ...(await import('@metorial-subspace/module-tenant/src/lib/sessionlessMcp')),
  subspaceScopeService: { ensureForProject: mocks.ensureForProject },
  tenantService: { upsertTenant: mocks.upsertTenant }
}));

import { projectSessionlessMcpConfigurationService } from '../src/services/projectSessionlessMcpConfiguration';

let tenant = {
  id: 'ten_1',
  name: 'Project',
  identifier: 'project-1',
  resourceTenantId: 'rtn_1',
  resourceTenantIdentifier: 'project-1',
  sessionlessMcpEnabled: null
};

let activeProject = {
  id: 'prj_1',
  oid: 1n,
  status: 'active',
  sessionlessMcpEnabled: null
};

let common = {
  organization: { id: 'org_1' } as any,
  auditScope: {} as any
};

describe('projectSessionlessMcpConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureForProject.mockResolvedValue({ tenant });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('get', () => {
    it('reports the global default as the value while the project has never written one', async () => {
      vi.stubEnv('METORIAL_ENV', 'production');
      expect(
        await projectSessionlessMcpConfigurationService.getProjectSessionlessMcpConfiguration({
          project: activeProject as any
        })
      ).toEqual({ sessionlessMcpEnabled: false });

      vi.stubEnv('METORIAL_ENV', 'staging');
      expect(
        await projectSessionlessMcpConfigurationService.getProjectSessionlessMcpConfiguration({
          project: activeProject as any
        })
      ).toEqual({ sessionlessMcpEnabled: true });
    });

    it('reports an explicit project value regardless of the global default', async () => {
      vi.stubEnv('METORIAL_ENV', 'production');

      expect(
        await projectSessionlessMcpConfigurationService.getProjectSessionlessMcpConfiguration({
          project: { ...activeProject, sessionlessMcpEnabled: true } as any
        })
      ).toEqual({ sessionlessMcpEnabled: true });
    });

    it('rejects deleted projects', async () => {
      await expect(
        projectSessionlessMcpConfigurationService.getProjectSessionlessMcpConfiguration({
          project: { ...activeProject, status: 'deleted' } as any
        })
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('writes the explicit value to the tenant mirror and the project', async () => {
      vi.stubEnv('METORIAL_ENV', 'production');
      mocks.upsertTenant.mockResolvedValue({ ...tenant, sessionlessMcpEnabled: true });
      mocks.projectUpdate.mockResolvedValue({ ...activeProject, sessionlessMcpEnabled: true });

      let result =
        await projectSessionlessMcpConfigurationService.updateProjectSessionlessMcpConfiguration(
          {
            ...common,
            project: activeProject as any,
            input: { sessionlessMcpEnabled: true }
          }
        );

      expect(result).toEqual({ sessionlessMcpEnabled: true });
      expect(mocks.upsertTenant).toHaveBeenCalledWith({
        input: expect.objectContaining({
          identifier: 'project-1',
          sessionlessMcpEnabled: true,
          environments: []
        })
      });
      expect(mocks.projectUpdate).toHaveBeenCalledWith({
        where: { oid: 1n },
        data: { sessionlessMcpEnabled: true }
      });
    });

    it('can turn sessionless off in an environment where it is on by default', async () => {
      vi.stubEnv('METORIAL_ENV', 'staging');
      mocks.upsertTenant.mockResolvedValue({ ...tenant, sessionlessMcpEnabled: false });
      mocks.projectUpdate.mockResolvedValue({
        ...activeProject,
        sessionlessMcpEnabled: false
      });

      let result =
        await projectSessionlessMcpConfigurationService.updateProjectSessionlessMcpConfiguration(
          {
            ...common,
            project: activeProject as any,
            input: { sessionlessMcpEnabled: false }
          }
        );

      expect(result).toEqual({ sessionlessMcpEnabled: false });
    });

    it('audits the previous value as the global default when the project had none', async () => {
      vi.stubEnv('METORIAL_ENV', 'staging');
      mocks.upsertTenant.mockResolvedValue({ ...tenant, sessionlessMcpEnabled: false });
      mocks.projectUpdate.mockResolvedValue({
        ...activeProject,
        sessionlessMcpEnabled: false
      });

      await projectSessionlessMcpConfigurationService.updateProjectSessionlessMcpConfiguration(
        {
          ...common,
          project: activeProject as any,
          input: { sessionlessMcpEnabled: false }
        }
      );

      expect(mocks.fire).toHaveBeenCalledWith(
        'organization.project.sessionless_mcp_configuration.updated:after',
        expect.objectContaining({
          configuration: { sessionlessMcpEnabled: false },
          previousConfiguration: { sessionlessMcpEnabled: true }
        })
      );
    });

    it('rejects deleted projects without touching anything', async () => {
      await expect(
        projectSessionlessMcpConfigurationService.updateProjectSessionlessMcpConfiguration({
          ...common,
          project: { ...activeProject, status: 'deleted' } as any,
          input: { sessionlessMcpEnabled: true }
        })
      ).rejects.toThrow();

      expect(mocks.upsertTenant).not.toHaveBeenCalled();
      expect(mocks.projectUpdate).not.toHaveBeenCalled();
    });
  });
});
