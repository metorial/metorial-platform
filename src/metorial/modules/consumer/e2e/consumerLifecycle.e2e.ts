import { withTestDb } from '@lowerdeck/testing-tools';
import { db } from '@metorial/db';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/lock', () => ({
  createLock: () => ({
    usingLock: async (_key: string, callback: () => Promise<unknown>) => await callback()
  })
}));

vi.mock('@metorial/module-search', () => ({
  searchConsumerIds: vi.fn()
}));

vi.mock('../src/queues/lifecycle/consumer', () => ({
  consumerCreatedQueue: { add: vi.fn() },
  consumerUpdatedQueue: { add: vi.fn() }
}));

import { consumerService } from '../src/services/consumers/consumer';

let { client: testDb } = withTestDb({
  prismaClientFactory: () => db,
  guard: url =>
    process.env.NODE_ENV === 'test' &&
    (process.env.CONTROL_WORKSPACE_ID === 'e2e' || url.toLowerCase().includes('test')),
  cleanBeforeEach: true
});

describe('consumer lifecycle (e2e)', () => {
  it('creates and updates both global and instance consumer records', async () => {
    let organization = await testDb.organization.create({
      data: {
        id: `org_e2e_${crypto.randomUUID()}`,
        type: 'default',
        status: 'active',
        slug: `consumer-e2e-${crypto.randomUUID()}`,
        previousSlugs: [],
        name: 'Consumer E2E',
        image: { type: 'default' },
        subspaceTenantIds: []
      }
    });
    let project = await testDb.project.create({
      data: {
        id: `prj_e2e_${crypto.randomUUID()}`,
        status: 'active',
        slug: `consumer-project-e2e-${crypto.randomUUID()}`,
        previousSlugs: [],
        name: 'Consumer E2E Project',
        organizationOid: organization.oid
      }
    });
    let instance = await testDb.instance.create({
      data: {
        id: `inst_e2e_${crypto.randomUUID()}`,
        type: 'development',
        status: 'active',
        slug: `consumer-instance-e2e-${crypto.randomUUID()}`,
        previousSlugs: [],
        name: 'Consumer E2E Instance',
        projectOid: project.oid,
        organizationOid: organization.oid
      }
    });

    let created = await consumerService.createConsumer({
      organization,
      instance,
      flags: { isManuallyCreated: true },
      input: {
        name: 'Original Consumer',
        email: 'original-consumer@example.com'
      }
    });
    let updated = await consumerService.updateConsumer({
      consumer: created,
      input: {
        name: 'Updated Consumer',
        email: 'updated-consumer@example.com'
      }
    });
    let reloaded = await consumerService.getConsumerById({
      instance,
      consumerId: created.id
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: 'Updated Consumer',
      email: 'updated-consumer@example.com'
    });
    expect(reloaded).toMatchObject({
      id: created.id,
      instanceOid: instance.oid,
      name: 'Updated Consumer',
      email: 'updated-consumer@example.com',
      consumer: {
        oid: created.consumerOid,
        organizationOid: organization.oid,
        name: 'Updated Consumer',
        email: 'updated-consumer@example.com',
        isManuallyCreated: true
      }
    });
  });
});
