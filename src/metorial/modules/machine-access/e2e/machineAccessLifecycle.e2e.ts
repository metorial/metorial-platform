import { withTestDb } from '@lowerdeck/testing-tools';
import { db } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { machineAccessService } from '../src/services/machineAccess';

let { client: testDb } = withTestDb({
  prismaClientFactory: () => db,
  guard: url =>
    process.env.NODE_ENV === 'test' &&
    (process.env.CONTROL_WORKSPACE_ID === 'e2e' || url.toLowerCase().includes('test')),
  cleanBeforeEach: true
});

describe('machine access lifecycle (e2e)', () => {
  it('creates, updates, and soft-deletes machine access with its actor', async () => {
    let organization = await testDb.organization.create({
      data: {
        id: `org_e2e_${crypto.randomUUID()}`,
        type: 'default',
        status: 'active',
        slug: `machine-access-e2e-${crypto.randomUUID()}`,
        previousSlugs: [],
        name: 'Machine Access E2E',
        image: { type: 'default' },
        subspaceTenantIds: []
      }
    });
    let performer = await testDb.organizationActor.create({
      data: {
        id: `oact_e2e_${crypto.randomUUID()}`,
        type: 'member',
        name: 'E2E Performer',
        image: { type: 'default' },
        organizationOid: organization.oid
      }
    });

    let machineAccess = await machineAccessService.createMachineAccess({
      type: 'organization_management',
      organization,
      performedBy: performer,
      input: {
        name: 'Automation',
        hasCustomScopes: true,
        scopes: ['server:read']
      },
      context: {} as any
    });

    let updated = await machineAccessService.updateMachineAccess({
      machineAccess,
      performedBy: performer,
      input: {
        name: 'Updated Automation',
        scopes: ['server:read', 'server:write']
      },
      context: {} as any
    });
    let deleted = await machineAccessService.deleteMachineAccess({
      machineAccess: updated,
      performedBy: performer,
      context: {} as any
    });
    let persisted = await testDb.machineAccess.findUniqueOrThrow({
      where: { id: machineAccess.id },
      include: { actor: true }
    });

    expect(deleted).toMatchObject({
      id: machineAccess.id,
      status: 'deleted',
      name: 'Updated Automation',
      scopes: ['server:read', 'server:write']
    });
    expect(persisted).toMatchObject({
      id: machineAccess.id,
      status: 'deleted',
      name: 'Updated Automation',
      scopes: ['server:read', 'server:write'],
      actor: {
        type: 'machine_access',
        name: 'Automation',
        organizationOid: organization.oid
      }
    });
    expect(persisted.deletedAt).toBeInstanceOf(Date);
  });
});
