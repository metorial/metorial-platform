import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@lowerdeck/service', () => ({
  Service: {
    create: vi.fn((_: string, factory: () => unknown) => ({
      build: () => factory()
    }))
  }
}));

vi.mock('@lowerdeck/error', () => ({
  forbiddenError: vi.fn(input => input),
  ServiceError: class ServiceError extends Error {}
}));

let update = vi.hoisted(() => vi.fn());
vi.mock('@metorial/db', () => ({
  db: { project: { update } }
}));

let fire = vi.hoisted(() => vi.fn());
vi.mock('@metorial/fabric', () => ({ Fabric: { fire } }));

let reconcileProjectOrganizationMembers = vi.hoisted(() => vi.fn());
vi.mock('../src/queues/reconcileOrganizationMembers', () => ({
  reconcileProjectOrganizationMembers
}));

import { projectWorkforceConfigurationService } from '../src/services/projectWorkforceConfiguration';

let project = (enabled: boolean) =>
  ({
    id: 'project-1',
    oid: 1n,
    status: 'active',
    autoAddOrganizationMembersToPortals: enabled
  }) as any;

describe('projectWorkforceConfigurationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('starts a project backfill only when the setting is enabled', async () => {
    update.mockResolvedValue(project(true));

    await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
      project: project(false),
      organization: { id: 'organization-1' } as any,
      auditScope: {} as any,
      input: { autoAddOrganizationMembersToPortals: true }
    });

    expect(reconcileProjectOrganizationMembers).toHaveBeenCalledWith('project-1');
    expect(fire).toHaveBeenCalledWith(
      'organization.project.workforce_configuration.updated:after',
      expect.objectContaining({
        project: expect.objectContaining({ autoAddOrganizationMembersToPortals: true }),
        previousProject: expect.objectContaining({
          autoAddOrganizationMembersToPortals: false
        })
      })
    );
  });

  it('does not delete or reconcile profiles when the setting is disabled', async () => {
    update.mockResolvedValue(project(false));

    await projectWorkforceConfigurationService.updateProjectWorkforceConfiguration({
      project: project(true),
      organization: { id: 'organization-1' } as any,
      auditScope: {} as any,
      input: { autoAddOrganizationMembersToPortals: false }
    });

    expect(reconcileProjectOrganizationMembers).not.toHaveBeenCalled();
  });
});
