import { UnifiedApiKey } from '@metorial/api-keys';
import { ID, type Instance } from '@metorial/db';
import { expectServiceError, testContext, uniqueId, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import {
  accessService,
  accessTagService,
  authenticationService,
  fineGrainedKeyService,
  sessionClientSecretReferenceService,
  type AnyAccessTagSelector,
  type Scope
} from '../src';

describe('module-access fine grained keys', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let createAccessTag = async (
    instance: Instance,
    entities: { roles: string[]; sessionId?: string }[]
  ) => {
    let accessTag = await accessTagService.createAccessTag({ instance });

    for (let entity of entities) {
      let policy = await db.accessTagPolicy.create({
        data: {
          id: await ID.generateId('accessTagPolicy'),
          name: uniqueId('e2e-tag-policy'),
          roles: entity.roles,
          organizationOid: instance.organizationOid
        }
      });
      await db.accessTagEntity.create({
        data: {
          accessTagOid: accessTag.oid,
          accessTagPolicyOid: policy.oid,
          subspaceSessionId: entity.sessionId ?? null
        }
      });
    }

    return accessTag;
  };

  let createKey = async (
    input: { expiresAt?: Date; roles?: string[]; sessionId?: string } = {}
  ) => {
    let fixture = await loadOrganizationFixture(org.ids);
    let accessTag = await createAccessTag(fixture.instance, [
      {
        roles: input.roles ?? ['instance.provider.session:read'],
        sessionId: input.sessionId ?? uniqueId('ses')
      }
    ]);
    let created = await fineGrainedKeyService.createFineGrainedKey({
      instance: fixture.instance,
      accessTag,
      input: { expiresAt: input.expiresAt }
    });

    return { fixture, accessTag, ...created };
  };

  let authenticate = (apiKey: string) =>
    authenticationService.authenticate({ type: 'api_key', apiKey, context: testContext() });

  it('creates keys only from access tags of the same instance', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let foreignTag = await createAccessTag(other.instance, [
      { roles: ['instance.provider.session:read'] }
    ]);

    await expectServiceError(
      fineGrainedKeyService.createFineGrainedKey({
        instance: fixture.instance,
        accessTag: foreignTag,
        input: {}
      }),
      'forbidden'
    );
    expect(await db.fineGrainedKey.count({ where: { accessTagOid: foreignTag.oid } })).toBe(0);

    let { fineGrainedKey, secret } = await createKey();
    expect(UnifiedApiKey.from(secret)?.type).toBe('fine_grained_token');

    let row = await db.fineGrainedKey.findUniqueOrThrow({ where: { id: fineGrainedKey.id } });
    expect(row).toMatchObject({
      status: 'active',
      instanceOid: fixture.instance.oid,
      secret,
      secretLength: secret.length,
      lastUsedAt: null,
      expiresAt: null
    });
    expect(row.secretRedacted).not.toBe(secret);
    expect(secret.startsWith(row.secretRedacted.split('...')[0]!)).toBe(true);
  });

  it('authenticates with the scopes and session grants of its access tag', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let sessionId = uniqueId('ses');
    let accessTag = await createAccessTag(fixture.instance, [
      { roles: ['instance.provider.session:write', 'not-a-scope'], sessionId },
      { roles: ['instance.file:read'] }
    ]);
    let { fineGrainedKey, secret } = await fineGrainedKeyService.createFineGrainedKey({
      instance: fixture.instance,
      accessTag,
      input: {}
    });

    let authInfo = await authenticate(secret);
    expect(authInfo.type).toBe('fine_grained');
    if (authInfo.type != 'fine_grained') return;

    expect([...authInfo.orgScopes].sort()).toEqual(
      [
        'instance.file:read',
        'instance.provider.session:read',
        'instance.provider.session:write'
      ].sort()
    );
    expect(authInfo.restrictions.accessTagGrants).toEqual([
      {
        resourceType: 'subspace.session',
        resourceId: sessionId,
        roles: ['instance.provider.session:write']
      }
    ]);
    expect(authInfo.restrictions.instance.id).toBe(org.ids.instanceId);
    expect(authInfo.auditScope.actor).toEqual({
      type: 'fine_grained_token',
      id: fineGrainedKey.id,
      metadata: { sessionIds: [sessionId] }
    });
    expect(
      (await db.fineGrainedKey.findUniqueOrThrow({ where: { id: fineGrainedKey.id } }))
        .lastUsedAt
    ).toBeInstanceOf(Date);

    let check = (possibleScopes: Scope[], fineGrainedPolicy?: 'allow' | 'deny') =>
      accessService.checkAccess({ authInfo, possibleScopes, fineGrainedPolicy });

    await expectServiceError(check(['instance.provider.session:read']), 'forbidden');
    await expectServiceError(check(['instance.provider.session:read'], 'deny'), 'forbidden');
    await check(['instance.provider.session:read'], 'allow');
    await check(['instance.file:read'], 'allow');
    await expectServiceError(check(['instance.secret:read'], 'allow'), 'forbidden');
  });

  it('rejects expired and revoked keys', async () => {
    let expired = await createKey({ expiresAt: new Date(Date.now() - 60_000) });
    let error = await expectServiceError(authenticate(expired.secret), 'unauthorized');
    expect(error.message).toMatch(/expired or has been revoked/);

    let valid = await createKey({ expiresAt: new Date(Date.now() + 60 * 60_000) });
    expect((await authenticate(valid.secret)).type).toBe('fine_grained');

    let revoked = await fineGrainedKeyService.revokeFineGrainedKey({
      fineGrainedKey: valid.fineGrainedKey,
      context: testContext()
    });
    expect(revoked.status).toBe('deleted');
    expect(revoked.deletedAt).toBeInstanceOf(Date);
    await expectServiceError(authenticate(valid.secret), 'unauthorized');

    let context = testContext();
    await expectServiceError(
      fineGrainedKeyService.revokeFineGrainedKey({ fineGrainedKey: revoked, context }),
      'forbidden'
    );
    await expectServiceError(
      fineGrainedKeyService.revealFineGrainedKey({ fineGrainedKey: revoked, context }),
      'forbidden'
    );
    await expectServiceError(
      fineGrainedKeyService.rotateFineGrainedKey({
        fineGrainedKey: revoked,
        context,
        input: {}
      }),
      'forbidden'
    );

    let listed = await fineGrainedKeyService.listFineGrainedKeysByInstance({
      instance: valid.fixture.instance
    });
    expect(listed.map(key => key.id)).not.toContain(revoked.id);
  });

  it('retires the previous secret when a key is rotated', async () => {
    let { fineGrainedKey, secret } = await createKey();
    let context = testContext();

    let rotated = await fineGrainedKeyService.rotateFineGrainedKey({
      fineGrainedKey,
      context,
      input: {}
    });
    expect(rotated.secret).not.toBe(secret);
    expect(rotated.fineGrainedKey.id).toBe(fineGrainedKey.id);

    await expectServiceError(authenticate(secret), 'unauthorized');
    let authInfo = await authenticate(rotated.secret);
    expect(authInfo.type == 'fine_grained' && authInfo.fineGrainedKey.id).toBe(
      fineGrainedKey.id
    );

    expect(
      await fineGrainedKeyService.revealFineGrainedKey({
        fineGrainedKey: rotated.fineGrainedKey,
        context
      })
    ).toBe(rotated.secret);
  });

  it('resolves keys only within their own instance', async () => {
    let { fixture, fineGrainedKey } = await createKey();
    let other = await loadOrganizationFixture(otherOrg.ids);

    let found = await fineGrainedKeyService.getFineGrainedKeyById({
      instance: fixture.instance,
      fineGrainedKeyId: fineGrainedKey.id
    });
    expect(found.instance.id).toBe(org.ids.instanceId);
    expect(
      (
        await fineGrainedKeyService.listFineGrainedKeysByInstance({
          instance: fixture.instance
        })
      ).map(key => key.id)
    ).toContain(fineGrainedKey.id);

    await expectServiceError(
      fineGrainedKeyService.getFineGrainedKeyById({
        instance: other.instance,
        fineGrainedKeyId: fineGrainedKey.id
      }),
      'not_found'
    );
    expect(
      (
        await fineGrainedKeyService.listFineGrainedKeysByInstance({ instance: other.instance })
      ).map(key => key.id)
    ).not.toContain(fineGrainedKey.id);
  });

  it('issues one session client secret per session from a shared organization policy', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let firstId = uniqueId('ses');
    let secondId = uniqueId('ses');

    let first = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId: firstId
    });
    let second = await sessionClientSecretReferenceService.createForSession({
      instance: fixture.instance,
      sessionId: secondId
    });
    expect(second.clientSecret).not.toBe(first.clientSecret);
    expect(second.reference.fineGrainedKeyOid).not.toBe(first.reference.fineGrainedKeyOid);
    expect(
      await db.accessTagPolicy.count({
        where: {
          organizationOid: fixture.organization.oid,
          systemIdentifier: 'session_client_secret'
        }
      })
    ).toBe(1);

    let secondAuth = await authenticate(second.clientSecret);
    expect(
      secondAuth.type == 'fine_grained' &&
        secondAuth.restrictions.accessTagGrants.map(grant => grant.resourceId)
    ).toEqual([secondId]);

    expect(
      (
        await sessionClientSecretReferenceService.getForSession({
          instance: fixture.instance,
          sessionId: firstId
        })
      )?.id
    ).toBe(first.reference.id);
    expect(
      (
        await sessionClientSecretReferenceService.getForSessions({
          instance: fixture.instance,
          sessionIds: [firstId, secondId, uniqueId('ses')]
        })
      )
        .map(reference => reference.id)
        .sort()
    ).toEqual([first.reference.id, second.reference.id].sort());
    expect(
      await sessionClientSecretReferenceService.getForSessions({
        instance: fixture.instance,
        sessionIds: []
      })
    ).toEqual([]);

    expect(
      await sessionClientSecretReferenceService.getForSession({
        instance: other.instance,
        sessionId: firstId
      })
    ).toBeNull();
    expect(
      await sessionClientSecretReferenceService.getForSessions({
        instance: other.instance,
        sessionIds: [firstId, secondId]
      })
    ).toEqual([]);
  });

  it('filters resources by access tag roles and sessions', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let sessionId = uniqueId('ses');
    let tag = await createAccessTag(fixture.instance, [
      { roles: ['instance.skill:read'], sessionId }
    ]);
    let untagged = await accessTagService.createAccessTag({ instance: fixture.instance });

    let findTagged = async (input: {
      tags: AnyAccessTagSelector;
      roles: Scope[];
      subspaceSessionId?: string;
    }) => {
      let filter = await accessTagService.getAccessTagFilter(input);
      return db.accessTag.findMany({
        where: { oid: { in: [tag.oid, untagged.oid] }, accessTagEntities: filter }
      });
    };

    expect(
      await accessTagService.getAccessTagFilter({
        tags: undefined,
        roles: ['instance.skill:read']
      })
    ).toBeUndefined();
    expect(
      (await findTagged({ tags: [tag, untagged], roles: ['instance.skill:read'] })).map(
        row => row.oid
      )
    ).toEqual([tag.oid]);
    expect(
      await findTagged({ tags: [tag, untagged], roles: ['instance.skill:write'] })
    ).toEqual([]);
    expect(
      (
        await findTagged({
          tags: { accessTagOid: tag.oid },
          roles: ['instance.skill:read'],
          subspaceSessionId: sessionId
        })
      ).map(row => row.oid)
    ).toEqual([tag.oid]);
    expect(
      await findTagged({
        tags: tag.oid,
        roles: ['instance.skill:read'],
        subspaceSessionId: uniqueId('ses')
      })
    ).toEqual([]);

    let checkTag = (roles: Scope[]) =>
      accessTagService.checkResourceAccess({
        tags: tag,
        roles,
        checker: filter =>
          db.accessTag.findFirst({ where: { oid: tag.oid, accessTagEntities: filter } })
      });

    await checkTag(['instance.skill:read']);
    await expectServiceError(checkTag(['instance.skill:write']), 'forbidden');

    let checked = false;
    await accessTagService.checkResourceAccess({
      roles: ['instance.skill:write'],
      checker: async () => {
        checked = true;
        return null;
      }
    });
    expect(checked).toBe(false);
  });
});
