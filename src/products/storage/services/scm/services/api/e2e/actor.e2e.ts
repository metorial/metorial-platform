import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { origin } from './client';
import { expectRpcError } from './errors';

describe('origin actor', () => {
  it('upserts an actor by identifier', async () => {
    let identifier = uniqueId('actor');

    let created = await origin.actor.upsert({ identifier, name: 'New Actor' });
    expect(created).toMatchObject({ identifier, name: 'New Actor' });

    let updated = await origin.actor.upsert({ identifier, name: 'Renamed Actor' });
    expect(updated).toMatchObject({ id: created.id, name: 'Renamed Actor' });

    expect(await db.actor.count({ where: { identifier } })).toBe(1);
  });

  it('gets an actor by id and by identifier', async () => {
    let identifier = uniqueId('actor');
    let created = await origin.actor.upsert({ identifier, name: 'Fetch Me' });

    expect(await origin.actor.get({ actorId: created.id })).toMatchObject({
      id: created.id,
      identifier
    });
    expect((await origin.actor.get({ actorId: identifier })).id).toBe(created.id);
  });

  it('keeps actors independent of tenants', async () => {
    let identifier = uniqueId('actor');
    let first = await origin.actor.upsert({ identifier, name: 'Shared' });

    let tenantA = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name: 'A' });
    let tenantB = await origin.tenant.upsert({ identifier: uniqueId('tenant'), name: 'B' });

    let sessionA = await origin.scmInstallationSession.create({
      tenantId: tenantA.id,
      actorId: first.id
    });
    let sessionB = await origin.scmInstallationSession.create({
      tenantId: tenantB.id,
      actorId: first.id
    });

    expect(sessionA.id).not.toBe(sessionB.id);
  });

  it('rejects an unknown actor', async () => {
    await expectRpcError(origin.actor.get({ actorId: uniqueId('missing') }), 'not_found');
  });

  it('validates the upsert input', async () => {
    await expectRpcError(
      origin.actor.upsert({ name: 'No Identifier' } as any),
      'invalid_data'
    );
    await expectRpcError(
      origin.actor.upsert({ identifier: 'no-name' } as any),
      'invalid_data'
    );
  });
});
