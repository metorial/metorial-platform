import { beforeEach, describe, expect, it, vi } from 'vitest';

let { rawNebula } = vi.hoisted(() => ({
  rawNebula: {
    tenant: {
      get: vi.fn(),
      upsert: vi.fn()
    }
  }
}));

vi.mock('@metorial/db', () => ({
  db: {
    project: {
      update: vi.fn()
    }
  }
}));

vi.mock('@metorial-platform-systems/nebula-client', () => ({
  createRawNebulaClient: vi.fn(() => rawNebula)
}));

vi.mock('./env', () => ({
  env: {
    service: {
      NEBULA_API_URL: 'http://nebula.test'
    }
  }
}));

import { db } from '@metorial/db';
import { ensureNebulaProjectTenant, getTenantForNebula } from './nebula';

describe('Nebula project tenants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reuses a fully persisted project tenant link', async () => {
    let project = {
      id: 'proj-1',
      nebulaTenantId: 'tenant-1',
      internalTenantIdentifier: 'mte-pro-1'
    };

    await expect(ensureNebulaProjectTenant(project as any)).resolves.toEqual({
      tenantId: 'tenant-1',
      tenantIdentifier: 'mte-pro-1',
      project
    });
    expect(rawNebula.tenant.upsert).not.toHaveBeenCalled();
    expect(db.project.update).not.toHaveBeenCalled();
  });

  it('upserts and persists a missing project tenant link', async () => {
    let project = {
      id: 'proj-1',
      oid: 42,
      name: 'Project',
      nebulaTenantId: null,
      internalTenantIdentifier: null
    };
    let updatedProject = {
      ...project,
      nebulaTenantId: 'tenant-1',
      internalTenantIdentifier: 'mte-pro-42'
    };
    rawNebula.tenant.upsert.mockResolvedValue({ id: 'tenant-1' });
    vi.mocked(db.project.update).mockResolvedValue(updatedProject as any);

    await expect(ensureNebulaProjectTenant(project as any)).resolves.toEqual({
      tenantId: 'tenant-1',
      tenantIdentifier: 'mte-pro-42',
      project: updatedProject
    });
    expect(rawNebula.tenant.upsert).toHaveBeenCalledWith({
      identifier: 'mte-pro-42',
      name: 'Project'
    });
    expect(db.project.update).toHaveBeenCalledWith({
      where: { id: 'proj-1' },
      data: {
        internalTenantIdentifier: 'mte-pro-42',
        nebulaTenantId: 'tenant-1'
      }
    });
  });

  it('loads Nebula tenant metadata after ensuring persistence', async () => {
    let project = {
      id: 'proj-1',
      nebulaTenantId: 'tenant-1',
      internalTenantIdentifier: 'mte-pro-1'
    };
    rawNebula.tenant.get.mockResolvedValue({
      id: 'tenant-1',
      defaultKeyProviderId: 'provider-1'
    });

    await expect(getTenantForNebula(project as any)).resolves.toEqual({
      id: 'tenant-1',
      identifier: 'mte-pro-1',
      defaultKeyProviderId: 'provider-1',
      project
    });
    expect(rawNebula.tenant.get).toHaveBeenCalledWith({ tenantId: 'tenant-1' });
  });
});
