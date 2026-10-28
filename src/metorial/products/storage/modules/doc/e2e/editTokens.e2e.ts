import { expectServiceError, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  __documentEditTokenTestUtils,
  documentEditTokenService,
  documentService
} from '../src';
import {
  createDocument,
  ensureOrganizationResourceActor,
  getDocument,
  privileged,
  scopeOf
} from './_fixtures';

let tokenTtlMs = 5 * 60 * 1000;

let issueFor = async (
  fixture: OrganizationFixture,
  documentId: string,
  input: Partial<Parameters<typeof documentEditTokenService.issueDocumentEditToken>[0]> = {}
) =>
  await documentEditTokenService.issueDocumentEditToken({
    documentId,
    instanceId: fixture.instance.id,
    organizationId: fixture.organization.id,
    accessActor: { name: 'E2E editor', organizationActorOid: fixture.actor.oid },
    permissions: ['content_read', 'content_write'],
    ...input
  });

let tamperSignature = (token: string) => {
  let last = token.at(-1) === 'a' ? 'b' : 'a';
  return `${token.slice(0, -1)}${last}`;
};

describe('module-documents edit tokens', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  afterEach(() => {
    vi.useRealTimers();
  });

  it('issues a five minute token that verifies for its document and tenant', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let actor = await ensureOrganizationResourceActor(fixture);
    let document = await createDocument(fixture);
    let issuedAt = Date.now();

    let issued = await issueFor(fixture, document.id, {
      accessActor: { name: 'E2E editor', resourceActorId: actor.id, identifier: 'e2e-editor' },
      accessTags: [11n, { oid: 22n }],
      permissions: ['content_read'],
      defaultPermissions: ['content_read'],
      overridePermissions: true
    });
    expect(issued.documentId).toBe(document.id);
    expect(issued.token.startsWith('document_edit_v1_')).toBe(true);
    expect(issued.expiresAt.getTime()).toBeGreaterThanOrEqual(issuedAt + tokenTtlMs);
    expect(issued.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + tokenTtlMs);

    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token: issued.token,
      documentId: document.id,
      instanceId: fixture.instance.id,
      organizationId: fixture.organization.id
    });
    expect(verified).toMatchObject({
      documentId: document.id,
      instanceId: fixture.instance.id,
      organizationId: fixture.organization.id,
      permissions: ['content_read'],
      accessTags: [11n, 22n],
      accessActor: { name: 'E2E editor', resourceActorId: actor.id, identifier: 'e2e-editor' },
      defaultPermissions: ['content_read'],
      overridePermissions: true
    });
    expect(verified.expiresAt.getTime()).toBe(issued.expiresAt.getTime());
    expect(verified.owner).toMatchObject({
      type: 'instance',
      instance: { id: fixture.instance.id },
      organization: { id: fixture.organization.id },
      project: { id: fixture.project.id }
    });

    let unscoped = await documentEditTokenService.verifyDocumentEditToken({
      token: issued.token,
      documentId: document.id
    });
    expect(unscoped.owner.instance.id).toBe(fixture.instance.id);
  });

  it('carries an organization actor through the token', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let issued = await issueFor(fixture, document.id);

    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token: issued.token,
      documentId: document.id
    });
    expect(verified.accessActor).toEqual({
      name: 'E2E editor',
      identifier: undefined,
      resourceActorId: undefined,
      organizationActorOid: fixture.actor.oid,
      consumerProfileOid: undefined
    });
    expect(verified.permissions).toEqual(['content_read', 'content_write']);
    expect(verified.accessTags).toEqual([]);
    expect(verified.defaultPermissions).toEqual([]);
    expect(verified.overridePermissions).toBe(false);
  });

  it('stops verifying once the token has expired', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let issued = await issueFor(fixture, document.id);

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(issued.expiresAt.getTime() + 1_000);
    let error = await expectServiceError(
      documentEditTokenService.verifyDocumentEditToken({
        token: issued.token,
        documentId: document.id
      }),
      'forbidden'
    );
    vi.useRealTimers();
    expect(error.message).toBe('Invalid document edit token');

    let expired = await __documentEditTokenTestUtils.createToken({
      claims: {
        documentId: document.id,
        instanceId: fixture.instance.id,
        organizationId: fixture.organization.id
      },
      expiresAt: new Date(Date.now() - 1_000)
    });
    await expectServiceError(
      documentEditTokenService.verifyDocumentEditToken({
        token: expired,
        documentId: document.id
      }),
      'forbidden'
    );
  });

  it('rejects tokens that outlive the five minute lifetime or come from the future', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let claims = {
      documentId: document.id,
      instanceId: fixture.instance.id,
      organizationId: fixture.organization.id
    };

    let overlong = await __documentEditTokenTestUtils.createToken({
      claims,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000)
    });
    await expectServiceError(
      documentEditTokenService.verifyDocumentEditToken({
        token: overlong,
        documentId: document.id
      }),
      'forbidden'
    );

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 60_000);
    let fromTheFuture = await __documentEditTokenTestUtils.createToken({ claims });
    vi.useRealTimers();
    await expectServiceError(
      documentEditTokenService.verifyDocumentEditToken({
        token: fromTheFuture,
        documentId: document.id
      }),
      'forbidden'
    );

    let withinLifetime = await __documentEditTokenTestUtils.createToken({ claims });
    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token: withinLifetime,
      documentId: document.id
    });
    expect(verified.documentId).toBe(document.id);
  });

  it('does not open another document, instance or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let documentA = await createDocument(fixture);
    let documentB = await createDocument(fixture);
    let foreignDocument = await createDocument(other);
    let issued = await issueFor(fixture, documentA.id);

    for (let input of [
      { documentId: documentB.id },
      { documentId: foreignDocument.id },
      { documentId: documentA.id, instanceId: other.instance.id },
      { documentId: documentA.id, organizationId: other.organization.id },
      {
        documentId: foreignDocument.id,
        instanceId: other.instance.id,
        organizationId: other.organization.id
      }
    ]) {
      await expectServiceError(
        documentEditTokenService.verifyDocumentEditToken({ token: issued.token, ...input }),
        'forbidden'
      );
    }

    let foreignIssued = await issueFor(other, foreignDocument.id);
    await expectServiceError(
      documentEditTokenService.verifyDocumentEditToken({
        token: foreignIssued.token,
        documentId: foreignDocument.id,
        instanceId: fixture.instance.id
      }),
      'forbidden'
    );
  });

  it('rejects signed claims that pair an instance with another organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let document = await createDocument(fixture);

    for (let claims of [
      { instanceId: other.instance.id, organizationId: fixture.organization.id },
      { instanceId: fixture.instance.id, organizationId: other.organization.id },
      { instanceId: 'inst_does_not_exist', organizationId: fixture.organization.id }
    ]) {
      let token = await __documentEditTokenTestUtils.createToken({
        claims: { documentId: document.id, ...claims }
      });
      let error = await expectServiceError(
        documentEditTokenService.verifyDocumentEditToken({ token, documentId: document.id }),
        'bad_request'
      );
      expect(error.message).toBe('Document edit token references an unknown instance');
    }
  });

  it('rejects tampered, foreign-type and malformed tokens', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let documentA = await createDocument(fixture);
    let documentB = await createDocument(fixture);
    let tokenA = (await issueFor(fixture, documentA.id)).token;
    let tokenB = (await issueFor(fixture, documentB.id)).token;

    let partsA = tokenA.split('_');
    let partsB = tokenB.split('_');
    let spliced = [...partsB.slice(0, -1), partsA.at(-1)].join('_');

    let foreignType = await __documentEditTokenTestUtils.createToken({
      type: 'file_download',
      claims: {
        documentId: documentA.id,
        instanceId: fixture.instance.id,
        organizationId: fixture.organization.id
      }
    });

    for (let [token, documentId] of [
      [tamperSignature(tokenA), documentA.id],
      [spliced, documentB.id],
      [foreignType, documentA.id],
      ['document_edit_v1_garbage_signature', documentA.id],
      ['', documentA.id]
    ] as const) {
      await expectServiceError(
        documentEditTokenService.verifyDocumentEditToken({ token, documentId }),
        'forbidden'
      );
    }
  });

  it('rejects signed claims without read access or with an ambiguous actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let base = {
      documentId: document.id,
      instanceId: fixture.instance.id,
      organizationId: fixture.organization.id
    };

    for (let claims of [
      { ...base, permissions: ['content_write' as const] },
      { ...base, permissions: [] },
      { ...base, version: 1 as any },
      {
        ...base,
        accessActor: { name: 'Ambiguous', resourceActorId: 'rac_1', organizationActorOid: '1' }
      },
      { ...base, accessActor: { name: 'Nobody' } },
      { ...base, accessTagOids: ['not-an-oid'] }
    ]) {
      let token = await __documentEditTokenTestUtils.createToken({ claims });
      await expectServiceError(
        documentEditTokenService.verifyDocumentEditToken({ token, documentId: document.id }),
        'forbidden'
      );
    }
  });

  it('refuses to issue tokens without read access or with an ambiguous actor', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);

    for (let input of [
      { permissions: ['content_write' as const] },
      { permissions: [] },
      { permissions: ['content_read' as const, 'content_read' as const] },
      {
        accessActor: {
          name: 'Ambiguous',
          resourceActorId: 'rac_1',
          organizationActorOid: fixture.actor.oid
        }
      },
      { accessActor: { name: 'Nobody' } },
      { accessActor: { name: '  ', organizationActorOid: fixture.actor.oid } }
    ]) {
      await expectServiceError(issueFor(fixture, document.id, input), 'forbidden');
    }
  });

  it('is a stateless capability: deleting the document does not revoke it, the document lookup rejects it', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let document = await createDocument(fixture);
    let issued = await issueFor(fixture, document.id);

    await documentService.deleteDocument({
      ...scopeOf(fixture),
      auditScope: fixture.auditScope,
      authorization: privileged,
      document: await getDocument(fixture, document.id)
    });

    let verified = await documentEditTokenService.verifyDocumentEditToken({
      token: issued.token,
      documentId: document.id
    });
    await expectServiceError(
      documentService.getDocumentById({
        project: verified.owner.project,
        instance: verified.owner.instance,
        documentId: verified.documentId,
        authorization: privileged
      }),
      'not_found'
    );
  });
});
