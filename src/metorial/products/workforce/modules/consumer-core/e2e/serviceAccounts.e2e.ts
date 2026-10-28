import { expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import type { Portal } from '@metorial/db';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { describe, expect, it } from 'vitest';
import { consumerServiceAccountService } from '../src';
import { createPortalSurface } from './_fixtures';

describe('module-consumer-core service accounts', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let scopes = ['consumer#instance.profile:read'];

  let create = async (
    fixture: OrganizationFixture,
    portal: Portal,
    input: { scopes?: string[] } = {}
  ) =>
    await consumerServiceAccountService.createConsumerServiceAccount({
      organization: fixture.organization,
      portal,
      auditScope: fixture.auditScope,
      input: { name: uniqueId('Consumer SA'), scopes: input.scopes ?? scopes }
    });

  let profilesOnSurface = async (surfaceOid: bigint) =>
    (await db.consumerProfile.findMany({ where: { surfaceOid } })).map(
      profile => profile.status
    );

  it('creates a consumer service account backed by a service-account profile on the portal', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, portal } = await createPortalSurface(fixture);

    let serviceAccount = await create(fixture, portal);

    expect(serviceAccount).toMatchObject({
      status: 'active',
      subjectType: 'consumer',
      scopes,
      organizationOid: fixture.organization.oid,
      portalOid: portal.oid
    });
    expect(serviceAccount.oauthApplication.subjectType).toBe('consumer');

    let profile = await db.consumerProfile.findUniqueOrThrow({
      where: { oid: serviceAccount.consumerProfileOid! },
      include: { consumer: true }
    });
    expect(profile).toMatchObject({
      status: 'active',
      inviteStatus: 'unset',
      surfaceOid: surface.oid,
      name: serviceAccount.name
    });
    expect(profile.email).toMatch(
      new RegExp(`^sa-.+@${fixture.organization.oid}\\.service-accounts\\.metorial\\.net$`)
    );
    expect(profile.consumer).toMatchObject({
      isServiceAccount: true,
      isPortalConsumer: true,
      organizationOid: fixture.organization.oid
    });
  });

  it('rejects inactive portals and portals of another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);

    let archivedPortal = await createPortalSurface(fixture);
    await db.portal.update({
      where: { oid: archivedPortal.portal.oid },
      data: { status: 'archived' }
    });

    let archivedSurface = await createPortalSurface(fixture);
    await db.consumerSurface.update({
      where: { oid: archivedSurface.surface.oid },
      data: { status: 'archived' }
    });

    let foreign = await createPortalSurface(other);

    for (let { surface, portal } of [archivedPortal, archivedSurface, foreign]) {
      await expectServiceError(
        create(fixture, await db.portal.findUniqueOrThrow({ where: { oid: portal.oid } })),
        'bad_request'
      );
      expect(await profilesOnSurface(surface.oid)).toEqual([]);
    }
  });

  it('removes the service-account profile again when the scopes are invalid', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { surface, portal } = await createPortalSurface(fixture);

    for (let invalidScopes of [['organization:read'], ['consumer#organization:fly']]) {
      await expectServiceError(
        create(fixture, portal, { scopes: invalidScopes }),
        'bad_request'
      );
    }

    expect(await profilesOnSurface(surface.oid)).toEqual(['deleted', 'deleted']);
    expect(await db.serviceAccount.count({ where: { portalOid: portal.oid } })).toBe(0);
  });

  it('archives a consumer service account and deletes its profile', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let { portal } = await createPortalSurface(fixture);
    let serviceAccount = await create(fixture, portal);

    let archived = await consumerServiceAccountService.archiveServiceAccountForSubject({
      serviceAccount,
      organization: fixture.organization,
      auditScope: fixture.auditScope
    });

    expect(archived.status).toBe('archived');
    let profile = await db.consumerProfile.findUniqueOrThrow({
      where: { oid: serviceAccount.consumerProfileOid! }
    });
    expect(profile).toMatchObject({ status: 'deleted', name: '[deleted]' });

    await expectServiceError(
      consumerServiceAccountService.archiveConsumerServiceAccount({
        serviceAccount: archived,
        organization: fixture.organization,
        auditScope: fixture.auditScope
      }),
      'forbidden'
    );
  });

  it('routes subject-typed creation to the right kind of service account', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let { portal } = await createPortalSurface(fixture);
    let foreign = await createPortalSurface(other);
    let createForSubject = (input: {
      subjectType?: 'consumer' | 'organization_member';
      portalId?: string;
      scopes: string[];
    }) =>
      consumerServiceAccountService.createServiceAccountForSubject({
        organization: fixture.organization,
        auditScope: fixture.auditScope,
        input: { name: uniqueId('Subject SA'), ...input }
      });

    await expectServiceError(
      createForSubject({ portalId: portal.id, scopes: ['organization:read'] }),
      'bad_request'
    );
    await expectServiceError(
      createForSubject({ subjectType: 'consumer', scopes }),
      'bad_request'
    );

    for (let portalId of [foreign.portal.id, uniqueId('missing-portal')]) {
      await expectServiceError(
        createForSubject({ subjectType: 'consumer', portalId, scopes }),
        'not_found'
      );
    }
    expect(await db.serviceAccount.count({ where: { portalOid: foreign.portal.oid } })).toBe(
      0
    );

    let member = await createForSubject({ scopes: ['organization:read'] });
    expect(member).toMatchObject({
      subjectType: 'organization_member',
      portalOid: null,
      consumerProfileOid: null
    });

    let consumer = await createForSubject({
      subjectType: 'consumer',
      portalId: portal.id,
      scopes
    });
    expect(consumer).toMatchObject({ subjectType: 'consumer', portalOid: portal.oid });
  });
});
