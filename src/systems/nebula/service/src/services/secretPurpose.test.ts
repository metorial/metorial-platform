import { beforeEach, describe, expect, it } from 'vitest';
import { secretPurposeService } from './secretPurpose';
import { secretPurposeCache } from '../lib/secretPurposeCache';
import { cleanDatabase, testDb } from '../test/setup';

describe('secretPurposeService', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('ensurePurpose returns cached rows on repeated calls', async () => {
    let first = await secretPurposeService.ensurePurpose('registry_credentials');
    let second = await secretPurposeService.ensurePurpose('registry_credentials');

    expect(second.oid).toBe(first.oid);
    expect(await testDb.secretPurpose.count()).toBe(1);
  });

  it('ensurePurpose upserts unknown identifiers', async () => {
    let purpose = await secretPurposeService.ensurePurpose('legacy_custom_purpose');

    expect(purpose.identifier).toBe('legacy_custom_purpose');
    expect(purpose.oid).toBeTypeOf('number');
    expect(secretPurposeCache.getByIdentifier('legacy_custom_purpose')).toEqual(purpose);
  });

  it('getPurposeIdentifier prefers purposeOid over purposeLegacy', async () => {
    let purpose = await testDb.secretPurpose.create({
      data: {
        oid: 401,
        identifier: 'oauth_token'
      }
    });
    secretPurposeCache.set(purpose);

    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: purpose.oid,
        purposeLegacy: 'stale_legacy_value'
      })
    ).resolves.toBe('oauth_token');
  });

  it('getPurposeIdentifier falls back to purposeLegacy', async () => {
    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: null,
        purposeLegacy: 'database_password'
      })
    ).resolves.toBe('database_password');
  });

  it('getPurposeIdentifier throws when purpose data is missing', async () => {
    await expect(
      secretPurposeService.getPurposeIdentifier({
        purposeOid: null,
        purposeLegacy: null
      })
    ).rejects.toThrow('Secret purpose is missing');
  });
});
