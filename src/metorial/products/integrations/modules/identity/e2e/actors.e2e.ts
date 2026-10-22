import {
  eventually,
  expectServiceError,
  firstPage,
  uniqueId,
  useOrganization
} from '@metorial/e2e';
import { db, loadOrganizationFixture, subspaceDb } from '@metorial/e2e/db';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import { Fabric } from '@metorial/fabric';
import { afterEach, describe, expect, it } from 'vitest';
import { identityActorMirrorService, identityActorService } from '../src';
import { createActor, identityScope, pageAll } from './_fixtures';

describe('module-identity actors', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let cleanups: (() => void)[] = [];

  afterEach(() => {
    for (let cleanup of cleanups.splice(0)) cleanup();
  });

  let findAgent = (actor: { oid: bigint }) =>
    subspaceDb.agent.findUniqueOrThrow({ where: { actorOid: actor.oid } });

  it('creates a person actor in the tenant scope and fires its created event', async () => {
    let scope = await identityScope(org);
    let { tenant, environment } = await resolveMetorialFacing(scope);
    let name = uniqueId('person');

    let events: string[] = [];
    cleanups.push(
      Fabric.listen('identity.actor.created:after', async event => {
        events.push(event.identityActor.id);
      })
    );

    let actor = await identityActorService.createIdentityActor({
      ...scope,
      input: {
        name: `  ${name}  `,
        description: '  A person  ',
        type: 'person',
        metadata: { e2e: true },
        privateMetadata: { secret: 'value' }
      }
    });
    expect(actor).toMatchObject({ name, description: 'A person', type: 'person' });
    expect(actor.agent).toBeNull();
    expect(events).toContain(actor.id);

    let row = await subspaceDb.identityActor.findUniqueOrThrow({ where: { id: actor.id } });
    expect(row).toMatchObject({
      status: 'active',
      type: 'person',
      metadata: { e2e: true },
      privateMetadata: { secret: 'value' },
      tenantOid: tenant.oid,
      environmentOid: environment.oid,
      instanceOid: environment.instanceOid,
      projectOid: tenant.projectOid,
      archivedAt: null
    });
  });

  it('keeps the agent row of an agent actor in sync through update and archive', async () => {
    let scope = await identityScope(org);
    let slug = uniqueId('agent-slug');
    let actor = await createActor(org, {
      type: 'agent',
      description: 'Agent',
      metadata: { version: 1 },
      _agentSlug: slug
    });

    let agent = await findAgent(actor);
    expect(agent).toMatchObject({
      status: 'active',
      name: actor.name,
      description: 'Agent',
      slug,
      tenantOid: actor.tenantOid,
      environmentOid: actor.environmentOid
    });
    expect(actor.agent?.id).toBe(agent.id);

    let name = uniqueId('renamed-agent');
    let updated = await identityActorService.updateIdentityActor({
      ...scope,
      identityActor: actor,
      input: { name, metadata: { version: 2 } }
    });
    expect(updated).toMatchObject({ name, description: 'Agent', metadata: { version: 2 } });
    expect(await findAgent(actor)).toMatchObject({
      name,
      description: 'Agent',
      metadata: { version: 2 }
    });

    let archived = await identityActorService.archiveIdentityActor({
      ...scope,
      identityActor: updated
    });
    expect(archived.status).toBe('archived');
    expect(archived.archivedAt).toBeInstanceOf(Date);
    expect(await findAgent(actor)).toMatchObject({
      status: 'archived',
      archivedAt: archived.archivedAt
    });
  });

  it('filters actors by agent id and slug', async () => {
    let scope = await identityScope(org);
    let agentActor = await createActor(org, { type: 'agent' });
    let personActor = await createActor(org);
    let agent = await findAgent(agentActor);
    let ids = [agentActor.id, personActor.id];

    for (let agentId of [agent.id, agent.slug]) {
      let listed = await firstPage(
        await identityActorService.listIdentityActors({ ...scope, ids, agentIds: [agentId] })
      );
      expect(listed.map(item => item.id)).toEqual([agentActor.id]);
    }
  });

  it('pages through actors and filters them by id and status', async () => {
    let scope = await identityScope(org);
    let actors = await Promise.all([createActor(org), createActor(org), createActor(org)]);
    let ids = actors.map(actor => actor.id);

    let paged = await pageAll(
      await identityActorService.listIdentityActors({ ...scope, ids })
    );
    expect(paged.map(item => item.id).sort()).toEqual([...ids].sort());

    await identityActorService.archiveIdentityActor({ ...scope, identityActor: actors[0]! });

    let active = await firstPage(
      await identityActorService.listIdentityActors({ ...scope, ids })
    );
    expect(active.map(item => item.id).sort()).toEqual([ids[1], ids[2]].sort());

    let archived = await firstPage(
      await identityActorService.listIdentityActors({ ...scope, ids, status: ['archived'] })
    );
    expect(archived.map(item => item.id)).toEqual([ids[0]]);

    let all = await firstPage(
      await identityActorService.listIdentityActors({
        ...scope,
        ids,
        status: ['active', 'archived']
      })
    );
    expect(all).toHaveLength(3);
  });

  it('requires a consumer owner exactly for consumer actors', async () => {
    let scope = await identityScope(org);
    let name = uniqueId('consumer');

    await expectServiceError(
      identityActorService.createIdentityActor({
        ...scope,
        input: { name, type: 'consumer' }
      }),
      'bad_request'
    );
    await expectServiceError(
      identityActorService.createIdentityActor({
        ...scope,
        consumerOwner: {
          consumerId: uniqueId('consumer'),
          instanceConsumerId: uniqueId('instance-consumer'),
          consumerProfileId: uniqueId('profile')
        },
        input: { name, type: 'person' }
      }),
      'bad_request'
    );

    expect(await subspaceDb.identityActor.count({ where: { name } })).toBe(0);
  });

  it('refuses to update or archive an archived actor but still resolves it', async () => {
    let scope = await identityScope(org);
    let actor = await createActor(org);
    let archived = await identityActorService.archiveIdentityActor({
      ...scope,
      identityActor: actor
    });

    await expectServiceError(
      identityActorService.updateIdentityActor({
        ...scope,
        identityActor: archived,
        input: { name: uniqueId('renamed') }
      }),
      'gone'
    );
    await expectServiceError(
      identityActorService.archiveIdentityActor({ ...scope, identityActor: archived }),
      'gone'
    );

    let fetched = await identityActorService.getIdentityActorById({
      ...scope,
      identityActorId: actor.id
    });
    expect(fetched).toMatchObject({ status: 'archived', name: actor.name });
  });

  it('protects tool call agents from updates and mcp client agents from archival', async () => {
    let scope = await identityScope(org);
    let toolCallActor = await createActor(org, { type: 'agent', _agentType: 'tool_call' });
    let mcpClientActor = await createActor(org, { type: 'agent', _agentType: 'mcp_client' });

    await expectServiceError(
      identityActorService.updateIdentityActor({
        ...scope,
        identityActor: toolCallActor,
        input: { name: uniqueId('renamed') }
      }),
      'agent_update_not_allowed'
    );
    await expectServiceError(
      identityActorService.archiveIdentityActor({ ...scope, identityActor: mcpClientActor }),
      'agent_delete_not_allowed'
    );

    let rows = await subspaceDb.identityActor.findMany({
      where: { id: { in: [toolCallActor.id, mcpClientActor.id] } }
    });
    expect(rows.map(row => [row.name, row.status]).sort()).toEqual(
      [
        [toolCallActor.name, 'active'],
        [mcpClientActor.name, 'active']
      ].sort()
    );
  });

  it('does not resolve, list, update or archive actors of another tenant', async () => {
    let actor = await createActor(org, { type: 'agent' });
    let agent = await findAgent(actor);
    let otherScope = await identityScope(otherOrg);

    await expectServiceError(
      identityActorService.getIdentityActorById({ ...otherScope, identityActorId: actor.id }),
      'not_found'
    );
    expect(
      await firstPage(
        await identityActorService.listIdentityActors({ ...otherScope, ids: [actor.id] })
      )
    ).toEqual([]);
    expect(
      await firstPage(
        await identityActorService.listIdentityActors({ ...otherScope, agentIds: [agent.id] })
      )
    ).toEqual([]);

    await expect(
      identityActorService.updateIdentityActor({
        ...otherScope,
        identityActor: actor,
        input: { name: uniqueId('hijacked') }
      })
    ).rejects.toThrow('Tenant mismatch');
    await expect(
      identityActorService.archiveIdentityActor({ ...otherScope, identityActor: actor })
    ).rejects.toThrow('Tenant mismatch');

    let row = await subspaceDb.identityActor.findUniqueOrThrow({ where: { id: actor.id } });
    expect(row).toMatchObject({ name: actor.name, status: 'active' });
  });

  it('mirrors actors and agents into the core database', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await createActor(org, { type: 'agent' });
    let agent = await findAgent(actor);

    let mirrored = await identityActorMirrorService.syncIdentityActor({
      identityActorId: actor.id
    });
    expect(mirrored).toMatchObject({
      id: actor.id,
      type: 'agent',
      status: 'active',
      name: actor.name,
      organizationOid: fixture.organization.oid,
      instanceOid: fixture.instance.oid
    });

    let mirroredAgent = await identityActorMirrorService.syncAgent({ agentId: agent.id });
    expect(mirroredAgent).toMatchObject({
      id: agent.id,
      status: 'active',
      actorOid: mirrored!.oid,
      organizationOid: fixture.organization.oid
    });

    await identityActorService.archiveIdentityActor({
      instance: fixture.instance,
      identityActor: actor
    });
    await identityActorMirrorService.syncAgent({ agentId: agent.id });

    expect(
      await db.identityActor.findUniqueOrThrow({ where: { id: actor.id } })
    ).toMatchObject({ status: 'archived' });
    expect(await db.agent.findUniqueOrThrow({ where: { id: agent.id } })).toMatchObject({
      status: 'archived'
    });
  });

  it('mirrors actors and agents into the core database through the worker', async () => {
    let scope = await identityScope(org);
    let actor = await createActor(org, { type: 'agent' });
    let agent = await findAgent(actor);

    await eventually(
      async () => {
        expect(
          await db.identityActor.findUniqueOrThrow({ where: { id: actor.id } })
        ).toMatchObject({ type: 'agent', status: 'active', name: actor.name });
        expect(await db.agent.findUniqueOrThrow({ where: { id: agent.id } })).toMatchObject({
          status: 'active'
        });
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );

    await identityActorService.archiveIdentityActor({ ...scope, identityActor: actor });

    await eventually(
      async () => {
        expect(
          await db.identityActor.findUniqueOrThrow({ where: { id: actor.id } })
        ).toMatchObject({ status: 'archived' });
        expect(await db.agent.findUniqueOrThrow({ where: { id: agent.id } })).toMatchObject({
          status: 'archived'
        });
      },
      { timeoutMs: 15_000, intervalMs: 500 }
    );
  });
});
