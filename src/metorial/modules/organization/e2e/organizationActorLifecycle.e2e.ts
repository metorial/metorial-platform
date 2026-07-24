import { withTestDb } from '@lowerdeck/testing-tools';
import { db } from '@metorial/db';
import { describe, expect, it } from 'vitest';
import { organizationActorService } from '../src/services/organizationActor';

let { client: testDb } = withTestDb({
  prismaClientFactory: () => db,
  guard: url =>
    process.env.NODE_ENV === 'test' &&
    (process.env.CONTROL_WORKSPACE_ID === 'e2e' || url.toLowerCase().includes('test')),
  cleanBeforeEach: true
});

describe('organization actor lifecycle (e2e)', () => {
  it('creates, updates, and reloads an actor from the database', async () => {
    let user = await testDb.user.create({
      data: {
        id: `usr_e2e_${crypto.randomUUID()}`,
        status: 'active',
        type: 'user',
        email: `organization-e2e-${crypto.randomUUID()}@example.com`,
        name: 'Organization E2E User',
        image: { type: 'default' }
      }
    });
    let organization = await testDb.organization.create({
      data: {
        id: `org_e2e_${crypto.randomUUID()}`,
        type: 'default',
        status: 'active',
        slug: `organization-e2e-${crypto.randomUUID()}`,
        previousSlugs: [],
        name: 'Organization E2E',
        image: { type: 'default' },
        subspaceTenantIds: []
      }
    });

    let actor = await organizationActorService.createOrganizationActor({
      organization,
      input: {
        type: 'member',
        name: 'Original Actor',
        email: 'actor@example.com'
      },
      performedBy: { type: 'user', user }
    });

    let updated = await organizationActorService.updateOrganizationActor({
      organization,
      actor,
      input: {
        name: 'Updated Actor',
        email: 'updated-actor@example.com'
      },
      context: {} as any,
      performedBy: actor
    });
    let reloaded = await organizationActorService.getOrganizationActorById({
      organization,
      actorId: actor.id
    });

    expect(updated).toMatchObject({
      id: actor.id,
      name: 'Updated Actor',
      email: 'updated-actor@example.com'
    });
    expect(reloaded).toMatchObject({
      id: actor.id,
      organizationOid: organization.oid,
      name: 'Updated Actor',
      email: 'updated-actor@example.com'
    });
  });
});
