import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { importKnowledge } from './knowledgeSupport';
import { createOrganization, createProject, groundstation, rpcErrorCode } from './support';

let hourMs = 60 * 60 * 1000;

type CreateInput = Parameters<
  ReturnType<typeof groundstation>['billing']['declarations']['create']
>[0];

type ListInput = Parameters<
  ReturnType<typeof groundstation>['billing']['declarations']['list']
>[0];

let hoursAgo = (hours: number) => new Date(Date.now() - hours * hourMs);

let createUser = (organization: { id: string }) =>
  groundstation().entity.upsert({
    organizationId: organization.id,
    kind: 'user',
    ref: uniqueId('user'),
    identifiers: [{ type: 'email', value: `${uniqueId('user')}@acme.com` }]
  });

describe('billing declarations', { timeout: 180_000 }, () => {
  it('creates declarations at every scope and manages them through every endpoint', async () => {
    await importKnowledge();

    let organization = await createOrganization();
    let project = await createProject(organization);
    let user = await createUser(organization);

    let organizationWide = await groundstation().billing.declarations.create({
      organizationId: organization.id,
      name: 'API keys everywhere',
      reason: 'No seats bought',
      mode: 'api',
      createdBy: 'e2e@example.com',
      validFrom: hoursAgo(24)
    });
    expect(organizationWide).toMatchObject({
      object: 'groundstation#billing_declaration',
      name: 'API keys everywhere',
      reason: 'No seats bought',
      projectId: null,
      userId: null,
      agentId: null,
      mode: 'api',
      plan: null,
      validTo: null,
      createdBy: 'e2e@example.com',
      archivedAt: null
    });
    expect(organizationWide.id.startsWith('gbd_')).toBe(true);

    let projectWide = await groundstation().billing.declarations.create({
      organizationId: organization.id,
      projectId: project.ref,
      name: 'Team plan',
      agentId: 'claude-code',
      mode: 'included',
      plan: ' team ',
      validFrom: hoursAgo(24)
    });
    expect(projectWide).toMatchObject({
      projectId: project.id,
      userId: null,
      agentId: 'claude-code',
      mode: 'included',
      plan: 'team'
    });

    let forUser = await groundstation().billing.declarations.create({
      organizationId: organization.id,
      userId: user.id,
      name: 'Extra usage',
      mode: 'overage',
      validFrom: hoursAgo(24),
      validTo: hoursAgo(-24)
    });
    expect(forUser).toMatchObject({ projectId: null, userId: user.id, mode: 'overage' });
    expect(forUser.validTo).not.toBeNull();

    let fetched = await groundstation().billing.declarations.get({
      organizationId: organization.id,
      billingDeclarationId: projectWide.id
    });
    expect(fetched).toMatchObject({ id: projectWide.id, projectId: project.id });

    let updated = await groundstation().billing.declarations.update({
      organizationId: organization.id,
      billingDeclarationId: projectWide.id,
      name: 'Max plan',
      plan: 'max',
      userId: user.id
    });
    expect(updated).toMatchObject({
      name: 'Max plan',
      plan: 'max',
      userId: user.id,
      projectId: project.id,
      mode: 'included'
    });

    let cleared = await groundstation().billing.declarations.update({
      organizationId: organization.id,
      billingDeclarationId: projectWide.id,
      projectId: null,
      agentId: null,
      plan: '',
      mode: 'api'
    });
    expect(cleared).toMatchObject({ projectId: null, agentId: null, plan: null, mode: 'api' });

    let list = (input: Partial<ListInput>) =>
      groundstation().billing.declarations.list({ organizationId: organization.id, ...input });
    let ids = async (input: Partial<ListInput> = {}) =>
      (await list(input)).items.map(item => item.id).sort();

    expect(await ids()).toEqual([organizationWide.id, projectWide.id, forUser.id].sort());
    expect(await ids({ modes: ['overage'] })).toEqual([forUser.id]);
    expect(await ids({ modes: ['api'] })).toEqual(
      [organizationWide.id, projectWide.id].sort()
    );
    expect(await ids({ userIds: [user.id] })).toEqual([projectWide.id, forUser.id].sort());
    expect(await ids({ agentIds: ['claude-code'] })).toEqual([]);
    expect(await ids({ projectIds: [project.id] })).toEqual([]);

    let paged = await list({ limit: 1 });
    expect(paged.items).toHaveLength(1);
    expect(paged.pagination.has_more_after).toBe(true);

    let archived = await groundstation().billing.declarations.archive({
      organizationId: organization.id,
      billingDeclarationId: forUser.id
    });
    expect(archived.archivedAt).not.toBeNull();

    let again = await groundstation().billing.declarations.archive({
      organizationId: organization.id,
      billingDeclarationId: forUser.id
    });
    expect(again.archivedAt).toEqual(archived.archivedAt);

    expect(await ids()).toEqual([organizationWide.id, projectWide.id].sort());
    expect(await ids({ includeArchived: true })).toEqual(
      [organizationWide.id, projectWide.id, forUser.id].sort()
    );
    expect(
      (
        await groundstation().billing.declarations.get({
          organizationId: organization.id,
          billingDeclarationId: forUser.id
        })
      ).archivedAt
    ).toEqual(archived.archivedAt);

    expect(
      await rpcErrorCode(
        groundstation().billing.declarations.update({
          organizationId: organization.id,
          billingDeclarationId: forUser.id,
          name: 'Too late'
        })
      )
    ).toBe('bad_request');
  });

  it('keeps declarations inside their organization', async () => {
    let organization = await createOrganization();
    let other = await createOrganization();

    let created = await groundstation().billing.declarations.create({
      organizationId: organization.id,
      name: 'Seats',
      mode: 'included'
    });

    let foreign = { organizationId: other.id, billingDeclarationId: created.id };
    expect(await rpcErrorCode(groundstation().billing.declarations.get(foreign))).toBe(
      'not_found'
    );
    expect(
      await rpcErrorCode(
        groundstation().billing.declarations.update({ ...foreign, name: 'Hijacked' })
      )
    ).toBe('not_found');
    expect(await rpcErrorCode(groundstation().billing.declarations.archive(foreign))).toBe(
      'not_found'
    );

    expect(
      (await groundstation().billing.declarations.list({ organizationId: other.id })).items
    ).toHaveLength(0);
    expect(
      (
        await groundstation().billing.declarations.get({
          organizationId: organization.id,
          billingDeclarationId: created.id
        })
      ).name
    ).toBe('Seats');
  });

  it('rejects invalid declarations', async () => {
    await importKnowledge();

    let organization = await createOrganization();
    let other = await createOrganization();
    let otherProject = await createProject(other);
    let foreignUser = await createUser(other);
    let team = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'team',
      ref: uniqueId('team')
    });

    let create = (input: Partial<CreateInput>) =>
      groundstation().billing.declarations.create({
        organizationId: organization.id,
        name: 'Invalid',
        mode: 'included',
        ...input
      });

    expect(await rpcErrorCode(create({ mode: 'unknown' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ mode: 'seat' as 'api' }))).toBe('invalid_data');
    expect(await rpcErrorCode(create({ agentId: 'no-such-agent' }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ userId: team.id }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ userId: foreignUser.id }))).toBe('not_found');
    expect(await rpcErrorCode(create({ projectId: otherProject.id }))).toBe('not_found');
    expect(await rpcErrorCode(create({ plan: 'x'.repeat(101) }))).toBe('bad_request');
    expect(await rpcErrorCode(create({ validFrom: hoursAgo(1), validTo: hoursAgo(2) }))).toBe(
      'bad_request'
    );

    expect(
      (await groundstation().billing.declarations.list({ organizationId: organization.id }))
        .items
    ).toHaveLength(0);

    let created = await create({ mode: 'api' });
    expect(
      await rpcErrorCode(
        groundstation().billing.declarations.update({
          organizationId: organization.id,
          billingDeclarationId: created.id,
          mode: 'unknown'
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        groundstation().billing.declarations.update({
          organizationId: organization.id,
          billingDeclarationId: created.id,
          validTo: new Date(new Date(created.validFrom).getTime() - hourMs)
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        groundstation().billing.declarations.get({
          organizationId: organization.id,
          billingDeclarationId: 'gbd_missing'
        })
      )
    ).toBe('not_found');
  });
});
