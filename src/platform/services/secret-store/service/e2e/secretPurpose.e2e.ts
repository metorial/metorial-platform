import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { secretPurposeCache } from '../src/lib/secretPurposeCache';
import { secretPurposeService } from '../src/services/secretPurpose';

let nextOid = 1_000_000_000 + Math.floor(Math.random() * 500_000_000);
let createPurpose = (identifier = uniqueId('purpose')) =>
  db.secretPurpose.create({ data: { oid: nextOid++, identifier } });

describe('nebula secret purpose cache', () => {
  it('loads all purposes into both lookups', async () => {
    let first = await createPurpose();
    let second = await createPurpose();

    secretPurposeCache.clear();
    await secretPurposeCache.loadAll();

    await expect(secretPurposeCache.getByIdentifierOrLoad(first.identifier)).resolves.toEqual(
      first
    );
    await expect(secretPurposeCache.getByOidOrLoad(second.oid)).resolves.toEqual(second);
  });

  it('populates both lookups on set without loading', async () => {
    let purpose = await createPurpose();
    secretPurposeCache.clear();

    secretPurposeCache.set(purpose);

    await expect(secretPurposeCache.getByIdentifierOrLoad(purpose.identifier)).resolves.toEqual(
      purpose
    );
    await expect(secretPurposeCache.getByOidOrLoad(purpose.oid)).resolves.toEqual(purpose);
  });

  it('reloads after clear', async () => {
    let purpose = await createPurpose();

    await secretPurposeCache.loadAll();
    secretPurposeCache.clear();

    await expect(
      secretPurposeCache.getByIdentifierOrLoad(purpose.identifier)
    ).resolves.toMatchObject({ oid: purpose.oid, identifier: purpose.identifier });
  });

  it('fetches purposes added after loadAll', async () => {
    await secretPurposeCache.loadAll();

    let byIdentifier = await createPurpose();
    let byOid = await createPurpose();

    await expect(
      secretPurposeCache.getByIdentifierOrLoad(byIdentifier.identifier)
    ).resolves.toEqual(byIdentifier);
    await expect(secretPurposeCache.getByOidOrLoad(byOid.oid)).resolves.toEqual(byOid);
  });
});

describe('nebula secret purpose service', () => {
  it('returns the same row for repeated ensurePurpose calls', async () => {
    let identifier = uniqueId('purpose');

    let first = await secretPurposeService.ensurePurpose(identifier);
    let second = await secretPurposeService.ensurePurpose(identifier);

    expect(second.oid).toBe(first.oid);
    expect(await db.secretPurpose.count({ where: { identifier } })).toBe(1);
  });

  it('upserts unknown identifiers', async () => {
    let identifier = uniqueId('purpose');

    let purpose = await secretPurposeService.ensurePurpose(identifier);

    expect(purpose.identifier).toBe(identifier);
    expect(purpose.oid).toBeTypeOf('number');
    await expect(secretPurposeCache.getByIdentifierOrLoad(identifier)).resolves.toEqual(
      purpose
    );
  });

  it('loads purposes created elsewhere before upserting', async () => {
    await secretPurposeCache.loadAll();
    let purpose = await createPurpose();

    await expect(secretPurposeService.ensurePurpose(purpose.identifier)).resolves.toEqual(
      purpose
    );
    expect(await db.secretPurpose.count({ where: { identifier: purpose.identifier } })).toBe(
      1
    );
  });

  it('prefers purposeOid over purposeLegacy', async () => {
    let purpose = await createPurpose();
    secretPurposeCache.set(purpose);

    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: purpose.oid,
        purposeLegacy: 'stale_legacy_value'
      })
    ).resolves.toBe(purpose.identifier);
  });

  it('loads purposeOid from the database when missing in the cache', async () => {
    await secretPurposeCache.loadAll();
    let purpose = await createPurpose();

    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: purpose.oid,
        purposeLegacy: 'stale_legacy_value'
      })
    ).resolves.toBe(purpose.identifier);
  });

  it('falls back to purposeLegacy', async () => {
    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: null,
        purposeLegacy: 'database_password'
      })
    ).resolves.toBe('database_password');
  });

  it('throws when purpose data is missing', async () => {
    await expect(
      secretPurposeService.getPurposeIdentifier({ purposeOid: null, purposeLegacy: null })
    ).rejects.toThrow('Secret purpose is missing');
  });
});
