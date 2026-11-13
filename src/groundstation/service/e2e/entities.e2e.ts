import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { groundstation, rpcErrorCode } from './support';

let createOrganization = async (settings?: { allowedEmailDomains?: string[] }) =>
  groundstation().organization.upsert({ ref: uniqueId('org'), settings });

let consumer = (organizationId: string, ref: string, email: string, name?: string) =>
  groundstation().entity.upsert({
    organizationId,
    kind: 'user',
    source: 'metorial.consumer',
    ref,
    name,
    identifiers: [{ type: 'email', value: email }]
  });

describe('kinds', () => {
  it('lists built-in kinds merged with overrides and custom kinds', async () => {
    let organization = await createOrganization();

    let override = await groundstation().kind.upsert({
      organizationId: organization.id,
      key: 'cost_center',
      name: 'Budget',
      attributes: { tagOrigins: ['source', 'repo'] }
    });
    let custom = await groundstation().kind.upsert({
      organizationId: organization.id,
      key: 'custom:department',
      name: 'Department',
      cardinality: 'multi'
    });

    expect(override).toMatchObject({
      object: 'groundstation#entity_kind',
      key: 'cost_center',
      name: 'Budget',
      builtIn: true,
      attributes: { tagOrigins: ['source', 'repo'] }
    });
    expect(custom).toMatchObject({ builtIn: false, cardinality: 'multi' });

    let kinds = await groundstation().kind.list({ organizationId: organization.id });
    let keys = kinds.items.map(kind => kind.key);

    expect(keys).toEqual(
      expect.arrayContaining(['user', 'team', 'cost_center', 'custom:department'])
    );
    expect(kinds.items.find(kind => kind.key == 'team')!.attributes.tagOrigins).toEqual([
      'source'
    ]);
  });

  it('rejects unknown kinds and tag origins on identity kinds', async () => {
    let organization = await createOrganization();

    expect(
      await rpcErrorCode(
        groundstation().kind.upsert({
          organizationId: organization.id,
          key: 'department',
          name: 'x'
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        groundstation().kind.upsert({
          organizationId: organization.id,
          key: 'device',
          attributes: { tagOrigins: ['source'] }
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        groundstation().kind.upsert({
          organizationId: organization.id,
          key: 'team',
          attributes: { tagOrigins: ['nowhere' as 'source'] }
        })
      )
    ).toBe('invalid_data');
  });
});

describe('entities', () => {
  it('upserts idempotently and presents without internal ids', async () => {
    let organization = await createOrganization();

    let created = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'team',
      ref: 'team-platform',
      name: 'Platform',
      slug: 'platform'
    });
    let again = await groundstation().entity.upsert({
      organizationId: organization.ref,
      kind: 'team',
      ref: 'team-platform',
      name: 'Platform team'
    });

    expect(created).toMatchObject({
      object: 'groundstation#entity',
      kind: 'team',
      status: 'managed',
      source: 'customer',
      slug: 'platform'
    });
    expect(created.id).toMatch(/^gen_/);
    expect(again.id).toBe(created.id);
    expect(again.name).toBe('Platform team');
    expect(JSON.stringify(created)).not.toContain('oid');

    let byId = await groundstation().entity.get({
      organizationId: organization.id,
      entityId: created.id
    });
    let byRef = await groundstation().entity.getByRef({
      organizationId: organization.id,
      kind: 'team',
      source: 'customer',
      ref: 'team-platform'
    });

    expect(byId.id).toBe(created.id);
    expect(byRef.id).toBe(created.id);
  });

  it('validates slugs and keeps them unique per kind', async () => {
    let organization = await createOrganization();

    await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'project',
      ref: 'p1',
      slug: 'billing'
    });

    expect(
      await rpcErrorCode(
        groundstation().entity.upsert({
          organizationId: organization.id,
          kind: 'project',
          ref: 'p2',
          slug: 'billing'
        })
      )
    ).toBe('conflict');
    expect(
      await rpcErrorCode(
        groundstation().entity.upsert({
          organizationId: organization.id,
          kind: 'project',
          ref: 'p3',
          slug: 'not a slug'
        })
      )
    ).toBe('bad_request');
  });

  it('lists with filters and pages through all entities', async () => {
    let organization = await createOrganization();

    for (let name of ['Alpha', 'Beta', 'Gamma']) {
      await groundstation().entity.upsert({
        organizationId: organization.id,
        kind: 'team',
        ref: uniqueId('team'),
        name
      });
    }
    await consumer(organization.id, 'con_1', 'needle@acme.com');

    let teams = await groundstation().entity.list({
      organizationId: organization.id,
      kinds: ['team'],
      limit: 1
    });
    expect(teams.items).toHaveLength(1);
    expect(teams.pagination.has_more_after).toBe(true);

    let seen = new Set<string>();
    let after: string | undefined;
    for (let page = 0; page < 5; page++) {
      let list = await groundstation().entity.list({
        organizationId: organization.id,
        kinds: ['team'],
        limit: 1,
        after
      });
      list.items.forEach(item => seen.add(item.id));
      if (!list.pagination.has_more_after) break;
      after = list.items.at(-1)!.id;
    }
    expect(seen.size).toBe(3);

    let search = await groundstation().entity.list({
      organizationId: organization.id,
      search: 'NEEDLE'
    });
    expect(search.items.map(item => item.ref)).toEqual(['con_1']);
  });

  it('merges a discovered-looking duplicate into a managed user', async () => {
    let organization = await createOrganization();

    let winner = await consumer(organization.id, 'con_w', 'w@acme.com');
    let loser = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'device',
      ref: 'device-x',
      source: 'metorial.device'
    });
    let duplicate = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'device',
      ref: 'device-y',
      source: 'metorial.device',
      identifiers: [{ type: 'host_id', value: 'h-1' }]
    });

    expect(
      await rpcErrorCode(
        groundstation().entity.merge({
          organizationId: organization.id,
          winnerId: winner.id,
          loserId: loser.id
        })
      )
    ).toBe('bad_request');

    let merged = await groundstation().entity.merge({
      organizationId: organization.id,
      winnerId: loser.id,
      loserId: duplicate.id
    });
    expect(merged.identifiers.map(identifier => identifier.value)).toEqual(['h-1']);

    let gone = await groundstation().entity.get({
      organizationId: organization.id,
      entityId: duplicate.id
    });
    expect(gone).toMatchObject({ status: 'merged', mergedIntoId: loser.id });
  });

  it('replaces identifiers of a type and archives entities', async () => {
    let organization = await createOrganization();

    let user = await consumer(organization.id, 'con_x', 'x@acme.com');

    let updated = await groundstation().entity.identifiers.set({
      organizationId: organization.id,
      entityId: user.id,
      types: ['email'],
      identifiers: [
        { type: 'email', value: 'X.New@Acme.com' },
        { type: 'email', value: 'x.alias@acme.com' }
      ]
    });
    expect(updated.identifiers.map(identifier => identifier.value).sort()).toEqual([
      'x.alias@acme.com',
      'x.new@acme.com'
    ]);

    let archived = await groundstation().entity.archive({
      organizationId: organization.id,
      entityId: user.id
    });
    expect(archived.status).toBe('archived');
    expect(archived.identifiers).toEqual([]);

    let live = await groundstation().entity.list({ organizationId: organization.id });
    expect(live.items.map(item => item.id)).not.toContain(user.id);
  });

  it('isolates organizations', async () => {
    let first = await createOrganization();
    let second = await createOrganization();

    let team = await groundstation().entity.upsert({
      organizationId: first.id,
      kind: 'team',
      ref: 'team'
    });

    expect(
      await rpcErrorCode(
        groundstation().entity.get({ organizationId: second.id, entityId: team.id })
      )
    ).toBe('not_found');
    expect(
      await rpcErrorCode(
        groundstation().entity.archive({ organizationId: second.id, entityId: team.id })
      )
    ).toBe('not_found');
    expect(
      (await groundstation().entity.list({ organizationId: second.id, kinds: ['team'] })).items
    ).toEqual([]);
    expect(
      await rpcErrorCode(groundstation().entity.list({ organizationId: uniqueId('missing') }))
    ).toBe('not_found');
  });
});

describe('links', () => {
  it('upserts, lists and ends links with reach', async () => {
    let organization = await createOrganization();

    let repo = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'repo',
      ref: 'acme/api',
      identifiers: [{ type: 'remote', value: 'github.com/Acme/API' }]
    });
    let project = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'project',
      ref: 'billing',
      slug: 'billing'
    });

    let link = await groundstation().link.upsert({
      organizationId: organization.id,
      fromId: repo.id,
      toId: project.id,
      type: 'part_of',
      reach: 'past_30_days'
    });

    expect(link).toMatchObject({
      object: 'groundstation#entity_link',
      type: 'part_of',
      origin: 'manual',
      from: { id: repo.id, kind: 'repo' },
      to: { id: project.id, kind: 'project' },
      validTo: null
    });
    expect(Date.now() - new Date(link.validFrom).getTime()).toBeGreaterThan(29 * 86_400_000);

    let listed = await groundstation().link.list({
      organizationId: organization.id,
      fromId: repo.id
    });
    expect(listed.items.map(item => item.id)).toEqual([link.id]);

    let ended = await groundstation().link.end({
      organizationId: organization.id,
      linkId: link.id
    });
    expect(ended.validTo).not.toBeNull();

    let active = await groundstation().link.list({
      organizationId: organization.id,
      toId: project.id
    });
    expect(active.items).toEqual([]);
  });

  it('rejects incompatible links and invalid weights', async () => {
    let organization = await createOrganization();

    let user = await consumer(organization.id, 'con_l', 'l@acme.com');
    let repo = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'repo',
      ref: 'r'
    });
    let team = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'team',
      ref: 't'
    });

    expect(
      await rpcErrorCode(
        groundstation().link.upsert({
          organizationId: organization.id,
          fromId: repo.id,
          toId: team.id,
          type: 'member_of'
        })
      )
    ).toBe('bad_request');
    expect(
      await rpcErrorCode(
        groundstation().link.upsert({
          organizationId: organization.id,
          fromId: user.id,
          toId: team.id,
          type: 'member_of',
          weight: 1.5
        })
      )
    ).toBe('invalid_data');
  });

  it('replaces the set of members of a target', async () => {
    let organization = await createOrganization();

    let team = await groundstation().entity.upsert({
      organizationId: organization.id,
      kind: 'team',
      ref: 'parent'
    });
    let children = [];
    for (let ref of ['a', 'b', 'c']) {
      children.push(
        await groundstation().entity.upsert({
          organizationId: organization.id,
          kind: 'team',
          ref
        })
      );
    }

    await groundstation().link.replaceSet({
      organizationId: organization.id,
      toId: team.id,
      type: 'part_of',
      from: [{ entityId: children[0]!.id }, { entityId: children[1]!.id }]
    });

    let result = await groundstation().link.replaceSet({
      organizationId: organization.id,
      toId: team.id,
      type: 'part_of',
      from: [{ entityId: children[1]!.id }, { entityId: children[2]!.id, weight: 0.5 }]
    });

    expect(result.added.map(link => link.from.id)).toEqual([children[2]!.id]);
    expect(result.removed.map(link => link.from.id)).toEqual([children[0]!.id]);
    expect(result.kept.map(link => link.from.id)).toEqual([children[1]!.id]);
  });
});

describe('user merge suggestions', () => {
  it('lists open suggestions and dismisses them', async () => {
    let organization = await createOrganization();

    let list = await groundstation().user.mergeSuggestions.list({
      organizationId: organization.id
    });
    expect(list.items).toEqual([]);

    expect(
      await rpcErrorCode(
        groundstation().user.mergeSuggestions.dismiss({
          organizationId: organization.id,
          mergeSuggestionId: 'gms_missing'
        })
      )
    ).toBe('not_found');
  });
});
