import { beforeEach, describe, expect, it } from 'vitest';
import { parseIngestCredential } from '../../auth/tokenSecret';
import { ingestSourcePresenter, ingestTokenPresenter } from '../../presenters';
import { expectServiceError } from '../../test/helpers';
import { createTestScope } from '../../test/scope';
import { cleanDatabase, testDb } from '../../test/setup';
import { ingestSourceService } from '../ingestSource';
import { ingestTokenService } from '../ingestToken';

let createToken = async (
  input: Partial<Parameters<typeof ingestTokenService.createIngestToken>[0]['input']> = {},
  scope?: Awaited<ReturnType<typeof createTestScope>>
) => {
  let resolved = scope ?? (await createTestScope());

  let created = await ingestTokenService.createIngestToken({
    organization: resolved.organization,
    instance: resolved.instance,
    input: { name: 'laptop', userRef: 'consumer_1', deviceRef: 'device_1', ...input }
  });

  return { ...resolved, ...created };
};

describe('ingest token service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  it('stores only a hash of the secret and returns the token once', async () => {
    let { ingestToken, secret } = await createToken();
    let plain = parseIngestCredential(secret)!.secret;

    expect(secret.startsWith('metorial_agit_')).toBe(true);
    expect(secret).toContain(ingestToken.prefix);
    expect(ingestToken.contentPolicy).toEqual({ defaultMode: 'basic' });

    let stored = await testDb.ingestToken.findUniqueOrThrow({ where: { id: ingestToken.id } });
    let storedValues = Object.values(stored).map(value =>
      JSON.stringify(value, (_, v) => (typeof v == 'bigint' ? String(v) : v))
    );

    expect(storedValues.join(' ')).not.toContain(plain);

    let presented = ingestTokenPresenter(ingestToken);
    expect(Object.keys(presented)).not.toContain('secretHash');
    expect(JSON.stringify(presented)).not.toContain(ingestToken.secretHash);
  });

  it('binds the token to managed user and device stubs', async () => {
    let { ingestToken, organization } = await createToken({ agentRef: 'client_1' });

    expect(ingestToken).toMatchObject({
      userRef: 'consumer_1',
      deviceRef: 'device_1',
      deviceMode: 'bound',
      agentRef: 'client_1'
    });
    expect(ingestToken.userEntity).toMatchObject({
      kind: 'user',
      source: 'metorial.consumer',
      ref: 'consumer_1',
      status: 'managed',
      organizationOid: organization.oid
    });
    expect(ingestToken.deviceEntity).toMatchObject({
      kind: 'device',
      source: 'metorial.device',
      ref: 'device_1'
    });
    expect(ingestToken.agentEntity).toMatchObject({
      kind: 'agent',
      source: 'metorial.client',
      ref: 'client_1'
    });
  });

  it('reuses the stubs across tokens of the organization', async () => {
    let first = await createToken();
    let second = await createToken({ name: 'other' }, first);
    let ephemeral = await createToken(
      { deviceRef: undefined, deviceMode: 'ephemeral' },
      first
    );

    expect(second.ingestToken.userEntityOid).toBe(first.ingestToken.userEntityOid);
    expect(second.ingestToken.deviceEntityOid).toBe(first.ingestToken.deviceEntityOid);
    expect(ephemeral.ingestToken.userEntityOid).toBe(first.ingestToken.userEntityOid);
    expect(ephemeral.ingestToken.deviceEntityOid).toBeNull();

    expect(
      await testDb.entity.count({ where: { organizationOid: first.organization.oid } })
    ).toBe(2);

    let otherOrganization = await createToken();
    expect(otherOrganization.ingestToken.userEntityOid).not.toBe(
      first.ingestToken.userEntityOid
    );
  });

  it('validates the device binding', async () => {
    let scope = await createTestScope();

    await expectServiceError(createToken({ deviceRef: undefined }, scope), 'bad_request');
    await expectServiceError(
      createToken({ deviceRef: 'device_1', deviceMode: 'ephemeral' }, scope),
      'bad_request'
    );
    await expectServiceError(
      createToken({ deviceRef: undefined, deviceMode: 'bound' }, scope),
      'bad_request'
    );
    await expectServiceError(createToken({ userRef: '  ' }, scope), 'bad_request');

    expect(await testDb.ingestToken.count()).toBe(0);
  });

  it('stores admin tags and keeps bindings on update', async () => {
    let { ingestToken } = await createToken({
      tags: [{ key: 'metorial.project', value: 'billing' }]
    });

    let updated = await ingestTokenService.updateIngestToken({
      ingestToken,
      input: { name: 'renamed', allowedClients: ['codex'] }
    });

    expect(updated).toMatchObject({
      name: 'renamed',
      allowedClients: ['codex'],
      userRef: 'consumer_1',
      deviceRef: 'device_1',
      userEntityOid: ingestToken.userEntityOid,
      tags: [{ key: 'metorial.project', value: 'billing' }]
    });
  });

  it('scopes get and list to the organization and instance', async () => {
    let first = await createToken();
    let second = await createToken();
    let sibling = await createTestScope({ organizationRef: first.organization.ref });
    let siblingToken = await createToken({}, { ...sibling, organization: first.organization });

    let found = await ingestTokenService.getIngestTokenById({
      organization: first.organization,
      ingestTokenId: first.ingestToken.id
    });
    expect(found.id).toBe(first.ingestToken.id);

    await expectServiceError(
      ingestTokenService.getIngestTokenById({
        organization: second.organization,
        ingestTokenId: first.ingestToken.id
      }),
      'not_found'
    );

    let all = await (
      await ingestTokenService.listIngestTokens({ organization: first.organization })
    ).run({ limit: 10 });
    let onInstance = await (
      await ingestTokenService.listIngestTokens({
        organization: first.organization,
        instance: first.instance
      })
    ).run({ limit: 10 });

    expect(all.items.map(item => item.id).sort()).toEqual(
      [first.ingestToken.id, siblingToken.ingestToken.id].sort()
    );
    expect(onInstance.items.map(item => item.id)).toEqual([first.ingestToken.id]);
  });

  it('rejects an expiry in the past', async () => {
    await expectServiceError(
      createToken({ expiresAt: new Date(Date.now() - 1000) }),
      'bad_request'
    );
  });

  it('refuses to update a revoked token and revoking is idempotent', async () => {
    let { ingestToken } = await createToken();

    let revoked = await ingestTokenService.revokeIngestToken({ ingestToken });
    let again = await ingestTokenService.revokeIngestToken({ ingestToken: revoked });

    expect(revoked.revokedAt).toBeInstanceOf(Date);
    expect(again.revokedAt?.getTime()).toBe(revoked.revokedAt?.getTime());

    await expectServiceError(
      ingestTokenService.updateIngestToken({ ingestToken: revoked, input: { name: 'x' } }),
      'precondition_failed'
    );
  });
});

describe('ingest source service', () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  let createSource = async () => {
    let scope = await createTestScope();
    let created = await ingestSourceService.createIngestSource({
      organization: scope.organization,
      instance: scope.instance,
      input: { name: 'Cursor', family: 'cursor', tags: [{ key: 'metorial.team', value: 'a' }] }
    });

    return { ...scope, ...created };
  };

  it('creates a source with defaults and returns the secret once', async () => {
    let { ingestSource, secret } = await createSource();

    expect(secret.startsWith('metorial_agis_')).toBe(true);
    expect(secret).toContain(ingestSource.prefix);
    expect(ingestSource).toMatchObject({
      family: 'cursor',
      newUserLimitPerDay: 50,
      contentPolicy: { defaultMode: 'basic' },
      tags: [{ key: 'metorial.team', value: 'a' }]
    });
    expect(JSON.stringify(ingestSourcePresenter(ingestSource))).not.toContain(
      ingestSource.secretHash
    );
  });

  it('rotates to a new prefix and secret', async () => {
    let { ingestSource, secret } = await createSource();

    let rotated = await ingestSourceService.rotateIngestSource({ ingestSource });

    expect(rotated.secret).not.toBe(secret);
    expect(rotated.ingestSource.id).toBe(ingestSource.id);
    expect(rotated.ingestSource.prefix).not.toBe(ingestSource.prefix);
    expect(rotated.ingestSource.secretHash).not.toBe(ingestSource.secretHash);
  });

  it('updates settings and refuses changes after revocation', async () => {
    let { ingestSource } = await createSource();

    let updated = await ingestSourceService.updateIngestSource({
      ingestSource,
      input: { name: 'Renamed', newUserLimitPerDay: 5, allowedChannels: ['otlp.logs'] }
    });

    expect(updated).toMatchObject({
      name: 'Renamed',
      newUserLimitPerDay: 5,
      allowedChannels: ['otlp.logs'],
      family: 'cursor'
    });

    let revoked = await ingestSourceService.revokeIngestSource({ ingestSource: updated });

    expect(revoked.revokedAt).toBeInstanceOf(Date);
    await expectServiceError(
      ingestSourceService.rotateIngestSource({ ingestSource: revoked }),
      'precondition_failed'
    );
    await expectServiceError(
      ingestSourceService.updateIngestSource({ ingestSource: revoked, input: { name: 'x' } }),
      'precondition_failed'
    );
  });

  it('scopes get to the organization', async () => {
    let first = await createSource();
    let second = await createSource();

    await expectServiceError(
      ingestSourceService.getIngestSourceById({
        organization: second.organization,
        ingestSourceId: first.ingestSource.id
      }),
      'not_found'
    );
  });
});
