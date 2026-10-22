import { eventually, expectServiceError, firstPage, useOrganization } from '@metorial/e2e';
import { db, loadOrganizationFixture, type OrganizationFixture } from '@metorial/e2e/db';
import type { ConsumerSurface, MagicMcpServer } from '@metorial/db';
import { consumerGroupService } from '@metorial/module-consumer-core';
import { describe, expect, it } from 'vitest';
import { consumerAccessRequestService } from '../src';
import {
  accessTagsFor,
  archiveMagicServer,
  canReadMagicServer,
  createGroup,
  createMagicServer,
  createProfile,
  createSurface
} from './_fixtures';

let workerTimeout = { timeoutMs: 60_000, intervalMs: 500 };

describe('module-consumer-access access requests', () => {
  let org = useOrganization();
  let otherOrg = useOrganization();

  let requestAccess = async (
    fixture: OrganizationFixture,
    consumerProfile: Awaited<ReturnType<typeof createProfile>>,
    magicMcpServer: MagicMcpServer,
    input?: { message?: string; metadata?: Record<string, unknown> }
  ) =>
    await consumerAccessRequestService.createConsumerAccessRequest({
      consumerProfile,
      accessRequest: { type: 'magic_mcp_server', magicMcpServer },
      auditScope: fixture.auditScope,
      input
    });

  let review = async (
    fixture: OrganizationFixture,
    consumerSurface: ConsumerSurface,
    consumerAccessRequestId: string,
    input: Parameters<
      typeof consumerAccessRequestService.reviewConsumerAccessRequest
    >[0]['input']
  ) =>
    await consumerAccessRequestService.reviewConsumerAccessRequest({
      organization: fixture.organization,
      consumerAccessRequest: await consumerAccessRequestService.getConsumerAccessRequestById({
        consumerSurface,
        consumerAccessRequestId
      }),
      auditScope: fixture.auditScope,
      input
    });

  let waitForAccess = async (consumerGroupOid: bigint, magicMcpServer: MagicMcpServer) =>
    await eventually(
      async () =>
        await db.consumerAccess.findFirstOrThrow({
          where: { consumerGroupOid, magicMcpServerOid: magicMcpServer.oid }
        }),
      workerTimeout
    );

  it('creates a pending request and rejects a duplicate pending one', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let otherProfile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);

    let request = await requestAccess(fixture, profile, server, {
      message: 'Please let me in',
      metadata: { reason: 'e2e' }
    });
    expect(request).toMatchObject({
      type: 'magic_mcp_server',
      status: 'pending',
      message: 'Please let me in',
      metadata: { reason: 'e2e' },
      pendingKey: `consumer_profile:${profile.oid}:magic_mcp_server:${server.oid}`,
      reviewedAt: null,
      surfaceOid: surface.oid
    });
    expect(request.magicMcpServer?.id).toBe(server.id);
    expect(request.consumerProfile.id).toBe(profile.id);

    await expectServiceError(requestAccess(fixture, profile, server), 'conflict');
    let otherRequest = await requestAccess(fixture, otherProfile, server);

    let fetched = await consumerAccessRequestService.getConsumerAccessRequestById({
      consumerSurface: surface,
      consumerAccessRequestId: request.id
    });
    expect(fetched.id).toBe(request.id);

    let list = async (
      filters: Omit<
        Parameters<typeof consumerAccessRequestService.listConsumerAccessRequests>[0],
        'consumerSurface'
      >
    ) =>
      (
        await firstPage(
          await consumerAccessRequestService.listConsumerAccessRequests({
            consumerSurface: surface,
            ...filters
          })
        )
      )
        .map(item => item.id)
        .sort();

    expect(await list({})).toEqual([request.id, otherRequest.id].sort());
    expect(await list({ consumerProfileIds: [profile.id] })).toEqual([request.id]);
    expect(await list({ magicMcpServerIds: [server.id], statuses: ['pending'] })).toEqual(
      [request.id, otherRequest.id].sort()
    );
    expect(await list({ statuses: ['approved', 'rejected'] })).toEqual([]);
  });

  it('approves a request and grants the requester access', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let request = await requestAccess(fixture, profile, server);
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(false);

    let approved = await review(fixture, surface, request.id, {
      status: 'approved',
      resolutionMessage: 'Welcome'
    });
    expect(approved).toMatchObject({
      status: 'approved',
      resolutionMessage: 'Welcome',
      pendingKey: null
    });
    expect(approved.reviewedAt).toBeInstanceOf(Date);

    let access = await waitForAccess(profile.personalConsumerGroupOid, server);
    expect(access.type).toBe('magic_mcp_server');
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(true);

    await expectServiceError(
      review(fixture, surface, request.id, { status: 'rejected' }),
      'precondition_failed'
    );

    let next = await requestAccess(fixture, profile, server);
    expect(next.status).toBe('pending');
    expect(next.id).not.toBe(request.id);
  });

  it('approves a request into a chosen consumer group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let group = await createGroup(fixture, surface);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let request = await requestAccess(fixture, profile, server);

    await review(fixture, surface, request.id, { status: 'approved', consumerGroup: group });

    let access = await waitForAccess(group.oid, server);
    expect(access.surfaceOid).toBe(surface.oid);
    expect(
      await db.consumerAccess.count({
        where: {
          consumerGroupOid: profile.personalConsumerGroupOid,
          magicMcpServerOid: server.oid
        }
      })
    ).toBe(0);
  });

  it('rejects a request without granting access and refuses further reviews', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let request = await requestAccess(fixture, profile, server);

    let rejected = await review(fixture, surface, request.id, {
      status: 'rejected',
      resolutionMessage: 'Not today'
    });
    expect(rejected).toMatchObject({
      status: 'rejected',
      resolutionMessage: 'Not today',
      pendingKey: null
    });

    await expectServiceError(
      review(fixture, surface, request.id, { status: 'approved' }),
      'precondition_failed'
    );
    await expectServiceError(
      review(fixture, surface, request.id, { status: 'rejected' }),
      'precondition_failed'
    );

    let row = await db.consumerAccessRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.status).toBe('rejected');
    expect(await db.consumerAccess.count({ where: { magicMcpServerOid: server.oid } })).toBe(
      0
    );
    expect(await canReadMagicServer(server, await accessTagsFor(profile))).toBe(false);
  });

  it('keeps a request pending when it is approved into an invalid group', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let surface = await createSurface(fixture);
    let otherSurface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let request = await requestAccess(fixture, profile, server);

    let foreignGroup = await createGroup(fixture, otherSurface);
    await expectServiceError(
      review(fixture, surface, request.id, {
        status: 'approved',
        consumerGroup: foreignGroup
      }),
      'not_found'
    );

    let archivedGroup = await consumerGroupService.deleteConsumerGroup({
      organization: fixture.organization,
      consumerSurface: surface,
      consumerGroup: await createGroup(fixture, surface),
      auditScope: fixture.auditScope
    });
    await expectServiceError(
      review(fixture, surface, request.id, {
        status: 'approved',
        consumerGroup: archivedGroup
      }),
      'precondition_failed'
    );

    let row = await db.consumerAccessRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row).toMatchObject({ status: 'pending', reviewedAt: null });
    expect(row.pendingKey).not.toBeNull();

    await review(fixture, surface, request.id, { status: 'approved' });
    await waitForAccess(profile.personalConsumerGroupOid, server);
  });

  it('rejects requests for inactive, consumer-deployed or foreign servers', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let profile = await createProfile(fixture, surface);

    let archived = await archiveMagicServer(fixture, await createMagicServer(fixture));
    await expectServiceError(requestAccess(fixture, profile, archived), 'precondition_failed');

    let consumerDeployed = await createMagicServer(fixture, {
      source: 'consumer_provider_template'
    });
    await expectServiceError(requestAccess(fixture, profile, consumerDeployed), 'not_found');

    let foreign = await createMagicServer(other);
    await expectServiceError(requestAccess(fixture, profile, foreign), 'not_found');

    expect(
      await db.consumerAccessRequest.count({ where: { consumerProfileOid: profile.oid } })
    ).toBe(0);
  });

  it('does not resolve or list requests of another surface or organization', async () => {
    let fixture = await loadOrganizationFixture(org.ids);
    let other = await loadOrganizationFixture(otherOrg.ids);
    let surface = await createSurface(fixture);
    let siblingSurface = await createSurface(fixture);
    let foreignSurface = await createSurface(other);
    let profile = await createProfile(fixture, surface);
    let server = await createMagicServer(fixture);
    let request = await requestAccess(fixture, profile, server);

    for (let consumerSurface of [siblingSurface, foreignSurface]) {
      await expectServiceError(
        consumerAccessRequestService.getConsumerAccessRequestById({
          consumerSurface,
          consumerAccessRequestId: request.id
        }),
        'not_found'
      );

      let listed = await firstPage(
        await consumerAccessRequestService.listConsumerAccessRequests({
          consumerSurface,
          consumerProfileIds: [profile.id]
        })
      );
      expect(listed).toEqual([]);
    }

    let foreignProfile = await createProfile(other, foreignSurface);
    await expectServiceError(requestAccess(other, foreignProfile, server), 'not_found');
  });
});
