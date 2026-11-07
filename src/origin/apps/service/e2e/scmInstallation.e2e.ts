import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { origin } from './client';
import { expectRpcError } from './errors';
import { createActor, createBackend, createInstallation, createTenant } from './fixtures';
import { db } from '../src/db';

let setup = async () => {
  let tenant = await createTenant();
  let actor = await createActor();
  let backend = await createBackend(tenant.id);
  let backendRow = await db.scmBackend.findUniqueOrThrow({ where: { id: backend.id } });

  return { tenant, actor, backendRow };
};

describe('origin scm installation', () => {
  it('gets an installation without exposing tokens', async () => {
    let { tenant, actor, backendRow } = await setup();
    let installation = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid,
      accountLogin: 'acme'
    });

    let fetched = await origin.scmInstallation.get({
      tenantId: tenant.id,
      scmInstallationId: installation.id
    });

    expect(fetched).toMatchObject({
      object: 'origin#scm_installation',
      id: installation.id,
      provider: 'gitlab',
      externalAccountLogin: 'acme',
      externalAccountName: 'Account Name'
    });

    let serialized = JSON.stringify(fetched);
    expect(serialized).not.toContain('secret-access-token');
    expect(serialized).not.toContain('secret-refresh-token');
    expect(Object.keys(fetched)).not.toContain('accessToken');
    expect(Object.keys(fetched)).not.toContain('refreshToken');
  });

  it('lists the installations of an actor', async () => {
    let { tenant, actor, backendRow } = await setup();
    let otherActor = await createActor();

    let first = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid
    });
    let second = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid
    });
    let foreignActor = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: otherActor.oid,
      backendOid: backendRow.oid
    });

    let list = await origin.scmInstallation.list({ tenantId: tenant.id, actorId: actor.id });

    let ids = list.items.map(item => item.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).not.toContain(foreignActor.id);
  });

  it('does not list installations of other tenants', async () => {
    let { tenant, actor, backendRow } = await setup();
    let other = await setup();

    await createInstallation({
      tenantOid: other.tenant.oid,
      actorOid: actor.oid,
      backendOid: other.backendRow.oid
    });
    let own = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid
    });

    let list = await origin.scmInstallation.list({ tenantId: tenant.id, actorId: actor.id });
    expect(list.items.map(item => item.id)).toEqual([own.id]);
  });

  it('pages through installations', async () => {
    let { tenant, actor, backendRow } = await setup();
    let created = await Promise.all(
      [1, 2, 3].map(() =>
        createInstallation({
          tenantOid: tenant.oid,
          actorOid: actor.oid,
          backendOid: backendRow.oid
        })
      )
    );

    let seen: string[] = [];
    let after: string | undefined;

    for (let page = 0; page < 10; page++) {
      let result = await origin.scmInstallation.list({
        tenantId: tenant.id,
        actorId: actor.id,
        limit: 1,
        after
      });
      expect(result.items.length).toBeLessThanOrEqual(1);
      seen.push(...result.items.map(item => item.id));
      if (!result.pagination.has_more_after) break;
      after = result.items[result.items.length - 1]!.id;
    }

    expect(seen).toHaveLength(3);
    expect(new Set(seen)).toEqual(new Set(created.map(item => item.id)));
  });

  it('returns an empty list for an actor without installations', async () => {
    let tenant = await createTenant();
    let actor = await createActor();

    let list = await origin.scmInstallation.list({ tenantId: tenant.id, actorId: actor.id });
    expect(list.items).toEqual([]);
    expect(list.pagination.has_more_after).toBe(false);
  });

  it('isolates installations between tenants', async () => {
    let { tenant, actor, backendRow } = await setup();
    let other = await createTenant();
    let installation = await createInstallation({
      tenantOid: tenant.oid,
      actorOid: actor.oid,
      backendOid: backendRow.oid
    });

    await expectRpcError(
      origin.scmInstallation.get({ tenantId: other.id, scmInstallationId: installation.id }),
      'not_found'
    );
  });

  it('rejects unknown installations and actors', async () => {
    let tenant = await createTenant();

    await expectRpcError(
      origin.scmInstallation.get({
        tenantId: tenant.id,
        scmInstallationId: uniqueId('missing')
      }),
      'not_found'
    );
    await expectRpcError(
      origin.scmInstallation.list({ tenantId: tenant.id, actorId: uniqueId('missing') }),
      'not_found'
    );
  });
});
